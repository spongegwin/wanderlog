export interface DetectedLink {
  icon: string;
  label: string;
  hostname: string;
}

interface Rule {
  match: RegExp;
  icon: string;
  label: string;
}

const RULES: Rule[] = [
  { match: /(chat\.)?whatsapp\.com/, icon: "💬", label: "WhatsApp" },
  { match: /splitwise\.com/, icon: "💰", label: "Splitwise" },
  { match: /tricount\.com/, icon: "💰", label: "Tricount" },
  { match: /venmo\.com|paypal\.me/, icon: "💰", label: "Venmo / PayPal" },
  { match: /\bt\.me\b|telegram\.(org|me)/, icon: "💬", label: "Telegram" },
  { match: /signal\.(org|me)/, icon: "💬", label: "Signal" },
  { match: /(discord\.gg|discord\.com)/, icon: "💬", label: "Discord" },
  { match: /slack\.com/, icon: "💬", label: "Slack" },
  { match: /docs\.google\.com/, icon: "📄", label: "Google Doc" },
  { match: /sheets\.google\.com/, icon: "📊", label: "Google Sheet" },
  { match: /(drive|forms)\.google\.com/, icon: "📁", label: "Google Drive" },
  { match: /notion\.so|notion\.com/, icon: "📝", label: "Notion" },
  { match: /airbnb\.com/, icon: "🏨", label: "Airbnb" },
  { match: /booking\.com/, icon: "🏨", label: "Booking.com" },
  { match: /alltrails\.com/, icon: "🥾", label: "AllTrails" },
  { match: /strava\.com/, icon: "🥾", label: "Strava" },
  { match: /caltopo\.com/, icon: "🗺️", label: "CalTopo" },
  { match: /gaiagps\.com/, icon: "🗺️", label: "Gaia GPS" },
  { match: /google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/, icon: "📍", label: "Google Maps" },
  { match: /catalinaexpress\.com/, icon: "⛴️", label: "Catalina Express" },
  { match: /instagram\.com/, icon: "📷", label: "Instagram" },
];

export function detectLink(url: string): DetectedLink {
  let hostname = url;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    hostname = parsed.hostname.replace(/^www\./, "");
  } catch {
    // not a parseable URL — fall through with raw string
  }

  const matchTarget = hostname.toLowerCase();
  for (const rule of RULES) {
    if (rule.match.test(matchTarget)) {
      return { icon: rule.icon, label: rule.label, hostname };
    }
  }
  return { icon: "🔗", label: hostname || "Link", hostname };
}
