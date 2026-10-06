/**
 * Pattern rules for English sentences that the UI computes from deterministic facts (headlines,
 * event titles, counts). Each rule rewrites a known English shape into Arabic; anything that does not
 * match stays English. Captured values (version labels, codes, names) are passed through verbatim.
 */
type Tr = (en: string) => string;

const FEM: Record<number, string> = { 3: 'ثلاث', 4: 'أربع', 5: 'خمس', 6: 'ست', 7: 'سبع', 8: 'ثماني', 9: 'تسع', 10: 'عشر' };
const EN_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const num = (w: string) => EN_NUM[w.toLowerCase()] ?? Number(w);
/** "كلمة واحدة" · "كلمتان" · "ثلاث كلمات" · "12 كلمة" */
export const words = (n: number) => (n === 1 ? 'كلمة واحدة' : n === 2 ? 'كلمتان' : FEM[n] ? `${FEM[n]} كلمات` : `${n} كلمة`);

const NOUN: Record<string, string> = {
  'the source text': 'النص المصدري', 'a grading field': 'حقل الحكم', 'a provenance field': 'حقل الإسناد',
  'a translation': 'الترجمة', 'a commentary field': 'حقل الشرح', 'a metadata field': 'حقل بيانات وصفية', 'a field': 'أحد الحقول',
  'The source text': 'النص المصدري', 'A grading field': 'حقل الحكم', 'A provenance field': 'حقل الإسناد',
  'A translation': 'الترجمة', 'A commentary field': 'حقل الشرح', 'A metadata field': 'حقل بيانات وصفية', 'A field': 'أحد الحقول',
};
const noun = (s: string) => NOUN[s] ?? s;

export const RULES: [RegExp, (m: RegExpMatchArray, t: Tr) => string][] = [
  // Change headlines (semantics.changeHeadline)
  [/^(\w+) words? (?:was|were) removed from (.+?)\.?$/, (m) => `حُذفت ${words(num(m[1]))} من ${noun(m[2])}${m[0].endsWith('.') ? '.' : ''}`],
  [/^(\w+) words? (?:was|were) added to (.+?)\.?$/, (m) => `أُضيفت ${words(num(m[1]))} إلى ${noun(m[2])}${m[0].endsWith('.') ? '.' : ''}`],
  [/^(.+) was reworded\.?$/, (m) => `أُعيدت صياغة ${noun(m[1])}.`],
  [/^(.+) changed\.$/, (m) => (NOUN[m[1]] ? `تغيّر ${noun(m[1])}.` : m[0])],
  // two-line H1 halves
  [/^(\w+) words? (?:was|were) removed$/, (m) => `حُذفت ${words(num(m[1]))}`],
  [/^(\w+) words? (?:was|were) added$/, (m) => `أُضيفت ${words(num(m[1]))}`],
  [/^from (.+?)\.?$/, (m) => `من ${noun(m[1])}.`],
  [/^to (.+?)\.?$/, (m) => (NOUN[m[1]] ? `إلى ${noun(m[1])}.` : m[0])],
  // Audit narration (events.narrate)
  [/^(\S+) seeded as the trusted baseline$/, (m) => `اعتُمدت ${m[1]} أساسًا موثوقًا (تهيئة)`],
  [/^(\S+) established as the trusted baseline$/, (m) => `اعتُمدت ${m[1]} أساسًا موثوقًا`],
  [/^(\S+) observed$/, (m) => `رُصدت ${m[1]}`],
  [/^(\S+) quarantined$/, (m) => `عُزلت ${m[1]}`],
  [/^(\S+) promoted$/, (m) => `اعتُمدت ${m[1]}`],
  [/^(\S+) matched$/, (m) => `انطبقت ${m[1]}`],
  [/^Regression compared on (.+)$/, (m) => `قورن الانحدار على ${m[1]}`],
  [/^Human decision · (.+)$/, (m, t) => `قرار بشري · ${t(m[1])}`],
  [/^Signed by (.+)$/, (m) => `وقّعه ${m[1]}`],
  [/^The gateway stays on (\S+)$/, (m) => `تبقى البوابة على ${m[1]}`],
  [/^Gateway switched from (\S+) to (\S+)$/, (m) => `حُوّلت البوابة من ${m[1]} إلى ${m[2]}`],
  [/^(\d+) changes? against the trusted version$/, (m) => `${m[1]} تغيير مقارنةً بالنسخة الموثوقة`],
  [/^Action (\w+)$/, (m, t) => `الإجراء: ${t(m[1])}`],
  // Source facts (connectors.kindShort / recordsPhrase)
  [/^level (\w+)$/, (m) => `المستوى ${m[1]}`],
  [/^(\d+) records?$/, (m) => (m[1] === '1' ? 'سجل واحد' : `${m[1]} سجلات`)],
  [/^(\d+) hadiths, (.+)$/, (m) => `${m[1]} أحاديث، ${m[2]}`],
  [/^(\d+) ayat$/, (m) => `${m[1]} آية`],
  [/^surahs (.+)$/, (m) => `السور ${m[1]}`],
  [/^(\d+) downstream assets$/, (m) => `${m[1]} أصول تابعة`],
  [/^(\d+) material runs?$/, (m) => (m[1] === '1' ? 'تشغيل جوهري واحد' : `${m[1]} تشغيلات جوهرية`)],
  // Blast Radius readings
  [/^(\S+) seen$/, (m) => `${m[1]} مرصودة`],
  [/^(\S+) trusted$/, (m) => `${m[1]} موثوقة`],
  [/^(.+) \(superseded\)$/, (m) => `${m[1]} (متجاوَزة)`],
  [/^batch (\w+)$/, (m) => `الدفعة ${m[1]}`],
  [/^run (\w+)$/, (m) => `التشغيل ${m[1]}`],
  [/^baseline (.+?)( \(not the incident baseline\))?$/, (m) => `الأساس ${m[1]}${m[2] ? ' (ليس أساس الحادثة)' : ''}`],
  [/^(\d+) (exposed|impacted|stale|healthy|changed|unchanged)$/, (m, t) => `${m[1]} ${t(m[2].charAt(0).toUpperCase() + m[2].slice(1))}`],
  [/^The record that changed: «(.+)» left the (.+) field\. Every edge in the radius starts here\.$/, (m) => `السجل الذي تغيّر: خرجت «${m[1]}» من الحقل ${m[2]}. ومن هنا تبدأ كل حواف النطاق.`],
  [/^The record that changed in its (.+) field\. Every edge in the radius starts here\.$/, (m) => `السجل الذي تغيّر حقله ${m[1]}. ومن هنا تبدأ كل حواف النطاق.`],
  [/^Its frozen copy still holds (.+), which would be superseded\. It needs a rebuild\.$/, (m) => `ما زالت نسخته المجمّدة تحمل ${m[1]}، وستصبح متجاوَزة؛ ويحتاج إلى إعادة بناء.`],
  [/^A materialized copy of (.+)\. After promotion it keeps the superseded version until rebuilt\.$/, (m) => `نسخة مجسَّدة من ${m[1]}. بعد الاعتماد تبقى على النسخة المتجاوَزة حتى يُعاد بناؤها.`],
  [/^Reads through the gateway, so it switches to (.+) in the same transaction as the binding\.$/, (m) => `يقرأ عبر البوابة، فينتقل إلى ${m[1]} في المعاملة نفسها مع الربط.`],
  // Risk
  [/^Risk (\w+) · advisory$/, (m, t) => `الخطورة ${t(m[1])} · استشاري`],
  [/^(Low|Medium|High|Critical) risk$/, (m, t) => `خطورة ${t(m[1].toLowerCase())}`],
];
