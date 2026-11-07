/**
 * WhatsApp Chat Export (.txt) Parser
 *
 * Supports:
 * - Date format MM/DD/YY and MM/DD/YYYY (also gracefully handles DD/MM/YY if month > 12,
 *   while defaulting to MM/DD/YY(YY) as specified)
 * - 12-hour time with AM/PM and 24-hour time
 * - Regular spaces and Unicode whitespace (\u202F, \u00A0, \u2009, \u2007, etc.)
 * - Invisible Unicode directional marks (\u200E, \u200F, \uFEFF)
 * - Sender names containing spaces, emojis, numbers, or special symbols
 * - Messages containing colons (:), URLs, emojis, and multi-line content
 * - System notification lines (lines with valid timestamp header but no `sender: message`)
 * - Media omitted lines (`<Media omitted>`, `<Media tidak disertakan>`, etc.)
 * - Preserves original message ordering for identical timestamps
 */

/**
 * Regex for matching the start of a WhatsApp exported message line.
 * Captures:
 *  1: datePart1 (MM)
 *  2: datePart2 (DD)
 *  3: yearPart  (YY or YYYY)
 *  4: hour      (1-2 digits)
 *  5: minute    (2 digits)
 *  6: second    (optional 2 digits)
 *  7: ampm      (optional AM/PM, case-insensitive, allowing periods like a.m.)
 *  8: body      (everything after the `- ` separator)
 */
const HEADER_REGEX = /^[\uFEFF\u200E\u200F]*\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),[\s\u00A0\u202F\u2007\u2009]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[\s\u00A0\u202F\u2007\u2009]*([AaPp]\.?[Mm]\.?))?\]?(?:[\s\u00A0\u202F]*[-–—][\s\u00A0\u202F]+|\s+)(.*)$/;

/**
 * Regex to separate `sender: message` without using `.split(':')`
 * Captures:
 *  1: sender name (at least 1 non-colon character)
 *  2: message content (can be empty or contain colons)
 */
const SENDER_MESSAGE_REGEX = /^[\u200E\u200F]*([^:]+?):\s?(.*)$/;

/**
 * Patterns that indicate a media placeholder message
 */
const MEDIA_OMITTED_PATTERNS = [
  /^[\u200E\u200F]*<media omitted>[\u200E\u200F]*$/i,
  /^[\u200E\u200F]*<media tidak disertakan>[\u200E\u200F]*$/i,
  /^[\u200E\u200F]*media omitted[\u200E\u200F]*$/i,
  /^[\u200E\u200F]*image omitted[\u200E\u200F]*$/i,
  /^[\u200E\u200F]*video omitted[\u200E\u200F]*$/i,
  /^[\u200E\u200F]*audio omitted[\u200E\u200F]*$/i,
  /^[\u200E\u200F]*document omitted[\u200E\u200F]*$/i,
  /^[\u200E\u200F]*sticker omitted[\u200E\u200F]*$/i,
  /^[\u200E\u200F]*gif omitted[\u200E\u200F]*$/i,
  /\(file attached\)$/i,
  /\(file terlampir\)$/i
];

/**
 * Normalize year from 2-digit or 4-digit string to full 4-digit year number
 * @param {string} yearStr
 * @returns {number}
 */
export function normalizeYear(yearStr) {
  const yr = Number(yearStr);
  if (yearStr.length === 2) {
    return yr >= 70 ? 1900 + yr : 2000 + yr;
  }
  return yr;
}

/**
 * Convert 12-hour time components to 24-hour { hours, minutes, seconds, timeString }
 * @param {string} hourStr
 * @param {string} minuteStr
 * @param {string|undefined} secondStr
 * @param {string|undefined} ampmStr
 * @returns {{ hours: number, minutes: number, seconds: number, time: string } | null}
 */
export function parseTimeComponents(hourStr, minuteStr, secondStr, ampmStr) {
  let hours = Number(hourStr);
  const minutes = Number(minuteStr);
  const seconds = secondStr !== undefined ? Number(secondStr) : 0;

  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return null;
  }
  if (minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return null;
  }

  if (ampmStr) {
    const normalizedAmPm = ampmStr.replace(/\./g, '').toUpperCase();
    if (hours < 1 || hours > 12) {
      return null;
    }
    if (normalizedAmPm === 'AM') {
      if (hours === 12) hours = 0;
    } else if (normalizedAmPm === 'PM') {
      if (hours !== 12) hours += 12;
    } else {
      return null;
    }
  } else {
    if (hours < 0 || hours > 23) {
      return null;
    }
  }

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return {
    hours,
    minutes,
    seconds,
    time: `${hh}:${mm}`
  };
}

/**
 * Validate and convert date parts (defaulting to MM/DD/YY or MM/DD/YYYY)
 * into { year, month, day, isoDate } and local timestamp.
 * @param {string} part1 - MM (or DD if part1 > 12)
 * @param {string} part2 - DD (or MM if part1 > 12)
 * @param {string} yearPart - YY or YYYY
 * @param {number} hours
 * @param {number} minutes
 * @param {number} seconds
 * @returns {{ isoDate: string, timestamp: number } | null}
 */
export function parseLocalDateTime(part1, part2, yearPart, hours, minutes, seconds = 0) {
  const p1 = Number(part1);
  const p2 = Number(part2);
  const year = normalizeYear(yearPart);

  let month = p1;
  let day = p2;

  // Primary format is MM/DD/YY or MM/DD/YYYY.
  // If p1 > 12 and p2 <= 12, fallback gracefully to DD/MM/YY so international exports don't crash.
  if (p1 > 12 && p2 >= 1 && p2 <= 12) {
    day = p1;
    month = p2;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  // Construct local Date object (never UTC!)
  const localDate = new Date(year, month - 1, day, hours, minutes, seconds, 0);

  // Verify calendar validity (e.g. reject Feb 30)
  if (
    localDate.getFullYear() !== year ||
    localDate.getMonth() !== month - 1 ||
    localDate.getDate() !== day
  ) {
    return null;
  }

  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');

  return {
    isoDate: `${yyyy}-${mm}-${dd}`,
    timestamp: localDate.getTime()
  };
}

/**
 * Determine message type ('text' | 'media' | 'system')
 * @param {string|null} sender
 * @param {string} messageText
 * @returns {'text' | 'media' | 'system'}
 */
export function classifyMessageType(sender, messageText) {
  if (!sender) {
    return 'system';
  }
  const trimmed = messageText.trim();
  for (const pattern of MEDIA_OMITTED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'media';
    }
  }
  return 'text';
}

/**
 * Parse a complete WhatsApp `.txt` export string.
 *
 * @param {string} rawText - Raw text content of the exported `.txt` file
 * @param {object} [options]
 * @param {string} [options.idPrefix='msg']
 * @returns {{
 *   messages: Array<{
 *     id: string,
 *     date: string,
 *     timestamp: number,
 *     time: string,
 *     sender: string,
 *     message: string,
 *     type: string
 *   }>,
 *   senders: Array<{ name: string, count: number }>,
 *   stats: {
 *     totalLines: number,
 *     parsedMessages: number,
 *     systemMessages: number,
 *     mediaMessages: number,
 *     multilineCount: number,
 *     unrecognizedLines: Array<{ lineNumber: number, content: string }>
 *   },
 *   dates: Array<string>
 * }}
 */
export function parseWhatsAppChat(rawText, options = {}) {
  const idPrefix = options.idPrefix || 'msg';

  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    return {
      messages: [],
      senders: [],
      stats: {
        totalLines: 0,
        parsedMessages: 0,
        systemMessages: 0,
        mediaMessages: 0,
        multilineCount: 0,
        unrecognizedLines: []
      },
      dates: []
    };
  }

  // Normalize line endings (\r\n or \r -> \n)
  const lines = rawText.replace(/\r\n?/g, '\n').split('\n');
  const messages = [];
  const senderCounts = new Map();
  const unrecognizedLines = [];
  const dateSet = new Set();

  let currentMessage = null;
  let systemMessages = 0;
  let mediaMessages = 0;
  let multilineCount = 0;
  let currentIsMultiline = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNumber = i + 1;

    // Attempt to match WhatsApp header at the start of the line
    const match = HEADER_REGEX.exec(rawLine);

    if (match) {
      const [, d1, d2, yr, hr, min, sec, ampm, body] = match;
      const timeData = parseTimeComponents(hr, min, sec, ampm);

      if (timeData) {
        const dateData = parseLocalDateTime(
          d1,
          d2,
          yr,
          timeData.hours,
          timeData.minutes,
          timeData.seconds
        );

        if (dateData) {
          // Finalize previous message if any
          if (currentMessage) {
            if (currentIsMultiline) multilineCount++;
            currentMessage.type = classifyMessageType(currentMessage.sender, currentMessage.message);
            if (currentMessage.type === 'media') mediaMessages++;
            messages.push(currentMessage);
          }

          currentIsMultiline = false;
          const cleanBody = body.replace(/^[\u200E\u200F]+/, '');
          const senderMatch = SENDER_MESSAGE_REGEX.exec(cleanBody);

          let sender = '';
          let messageText = cleanBody;
          let type = 'system';

          if (senderMatch) {
            sender = senderMatch[1].trim();
            messageText = senderMatch[2];
            type = classifyMessageType(sender, messageText);

            if (sender) {
              senderCounts.set(sender, (senderCounts.get(sender) || 0) + 1);
            }
          } else {
            // System notification (e.g., "Messages and calls are end-to-end encrypted...")
            sender = '';
            messageText = cleanBody.trim();
            type = 'system';
            systemMessages++;
          }

          dateSet.add(dateData.isoDate);

          const msgIndex = messages.length + 1;
          currentMessage = {
            id: `${idPrefix}-${msgIndex}`,
            date: dateData.isoDate,
            timestamp: dateData.timestamp,
            time: timeData.time,
            sender,
            message: messageText,
            type
          };

          continue;
        }
      }
    }

    // Not a valid header line:
    // If we already have a current message, append as continuation (multi-line message).
    if (currentMessage) {
      currentMessage.message += '\n' + rawLine;
      currentIsMultiline = true;
    } else {
      // Line appears before the very first valid message header.
      // Ignore pure empty lines, record non-empty lines as unrecognized.
      if (rawLine.trim().length > 0) {
        unrecognizedLines.push({
          lineNumber,
          content: rawLine.slice(0, 200)
        });
      }
    }
  }

  // Push last active message
  if (currentMessage) {
    if (currentIsMultiline) multilineCount++;
    currentMessage.type = classifyMessageType(currentMessage.sender, currentMessage.message);
    if (currentMessage.type === 'media') mediaMessages++;
    messages.push(currentMessage);
  }

  // Build sorted list of senders by frequency (descending)
  const senders = Array.from(senderCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const dates = Array.from(dateSet).sort();

  return {
    messages,
    senders,
    stats: {
      totalLines: lines.length,
      parsedMessages: messages.length,
      systemMessages,
      mediaMessages,
      multilineCount,
      unrecognizedLines
    },
    dates
  };
}
