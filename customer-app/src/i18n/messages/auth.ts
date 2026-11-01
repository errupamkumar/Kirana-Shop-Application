// Login and OTP.
const en = {
  'login.screenTitle': 'Log in',
  'login.heroTitle': 'Groceries from your neighbourhood kirana',
  'login.heroSubtitle': 'Fresh stock, fair prices, delivered by the store you know.',
  'login.title': 'Log in or sign up',
  'login.subtitle': "We'll send a 6 digit code to your mobile number.",
  'login.mobileLabel': 'Mobile number',
  'login.mobilePlaceholder': '10 digit mobile number',
  'login.mobileInvalid': 'Indian mobile numbers start with 6, 7, 8 or 9.',
  'login.sendOtp': 'Send OTP',
  'login.privacy': 'Your number is only used to log in and for delivery updates.',
  'otp.screenTitle': 'Verify',
  'otp.title': 'Enter verification code',
  'otp.sentTo': 'Sent by SMS to',
  'otp.codeLabel': 'One time password',
  'otp.resendIn': 'Resend code in {seconds}s',
  'otp.resend': 'Resend code',
  'otp.changeNumber': 'Change number',
  'otp.verify': 'Verify and continue',
} as const;

const hi: Record<keyof typeof en, string> = {
  'login.screenTitle': 'लॉग इन',
  'login.heroTitle': 'आपकी पड़ोस की किराना दुकान से राशन',
  'login.heroSubtitle': 'ताज़ा सामान, सही दाम, आपकी जानी-पहचानी दुकान से घर तक।',
  'login.title': 'लॉग इन या साइन अप करें',
  'login.subtitle': 'हम आपके मोबाइल नंबर पर 6 अंकों का कोड भेजेंगे।',
  'login.mobileLabel': 'मोबाइल नंबर',
  'login.mobilePlaceholder': '10 अंकों का मोबाइल नंबर',
  'login.mobileInvalid': 'भारतीय मोबाइल नंबर 6, 7, 8 या 9 से शुरू होते हैं।',
  'login.sendOtp': 'OTP भेजें',
  'login.privacy': 'आपका नंबर सिर्फ़ लॉग इन और डिलीवरी की जानकारी के लिए इस्तेमाल होता है।',
  'otp.screenTitle': 'पुष्टि करें',
  'otp.title': 'पुष्टि कोड डालें',
  'otp.sentTo': 'SMS भेजा गया',
  'otp.codeLabel': 'वन टाइम पासवर्ड',
  'otp.resendIn': '{seconds} सेकंड में दोबारा भेज सकते हैं',
  'otp.resend': 'कोड दोबारा भेजें',
  'otp.changeNumber': 'नंबर बदलें',
  'otp.verify': 'पुष्टि करें और आगे बढ़ें',
};

export const auth = { en, hi };
