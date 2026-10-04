import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const content='/records/0/content/';
const replace=(path,value)=>({op:'replace',path,value});
const remove=path=>({op:'remove',path});
const baseValue=(path,value)=>[replace(content+path,value)];

function fixture(id,category,options) {
  const {
    path=null,role='UNCLASSIFIED',type='FIELD_MODIFIED',flags=[],action='REVIEW',
    analysis='METADATA_CHANGE',material=false,minRisk='LOW',maxRisk='LOW',
    base='had-4821.v13.json',basePatch=[],patches=[],sameLabel=false,
    rawTransform,serializationOnly=false,
  }=options;
  const mutation=[...patches];
  if(!sameLabel) mutation.push(replace('/upstreamVersionLabel',`eval-${id.toLowerCase()}`));
  return {
    id,category,base,...(basePatch.length?{basePatch}:{}),mutation,
    ...(rawTransform?{rawTransform}:{}),
    expected:{
      changes:path===null?[]:[{canonicalKey:'HAD-4821',changeType:type,fieldPath:path,fieldRole:role,flags}],
      field_roles:path===null?[]:[role],flags,silent_mutation:sameLabel,
      analysis_type:analysis,material,min_risk:minRisk,max_risk:maxRisk,policy_action:action,
      ...(serializationOnly?{serialization_only:true}:{}),
    },
  };
}
const judgment=(id,options)=>fixture(id,options.category??'Hadith / Evidence Drift',{path:'judgment',role:'SCHOLAR_JUDGMENT',analysis:'EVIDENCE_DRIFT',material:true,minRisk:'HIGH',maxRisk:'CRITICAL',action:'QUARANTINE',...options});
const translation=(id,options)=>fixture(id,options.category??'Translation + provenance',{path:'translation',role:'TRANSLATION',analysis:'TRANSLATION_DRIFT',material:true,minRisk:'MEDIUM',maxRisk:'CRITICAL',action:'REVIEW',...options});
const provenance=(id,options)=>fixture(id,options.category??'Translation + provenance',{role:'PROVENANCE',analysis:'PROVENANCE_DRIFT',material:false,minRisk:'LOW',maxRisk:'HIGH',action:'REVIEW',...options});
const arabic=(id,options)=>fixture(id,options.category??'Arabic / deletion / edge',{path:'arabic_text',role:'AUTHORITATIVE_TEXT',analysis:'CANONICAL_TEXT_CHANGE',material:true,minRisk:'HIGH',maxRisk:'CRITICAL',action:'QUARANTINE',...options});

const fixtures=[
  judgment('FMT-01',{category:'Benign / formatting / metadata',patches:[replace(content+'judgment',' إسناده   صحيح ')],flags:['WHITESPACE_ONLY'],action:'ALLOW',material:false,minRisk:'LOW',maxRisk:'LOW'}),
  judgment('FMT-02',{category:'Benign / formatting / metadata',patches:[replace(content+'judgment','إسناده\nصحيح')],flags:['WHITESPACE_ONLY'],action:'ALLOW',material:false,minRisk:'LOW',maxRisk:'LOW'}),
  fixture('FMT-03','Benign / formatting / metadata',{sameLabel:true,rawTransform:'reverse-key-order',serializationOnly:true,action:'ALLOW'}),
  judgment('FMT-04',{category:'Benign / formatting / metadata',patches:[replace(content+'judgment','إسناده صحيح')],flags:['UNICODE_EQUIVALENT'],action:'ALLOW',material:false,minRisk:'LOW',maxRisk:'LOW'}),
  fixture('FMT-05','Benign / formatting / metadata',{path:'display_label',role:'OPERATIONAL_METADATA',patches:[replace(content+'display_label','Sandbox record HAD-4821 (synthetic)!')],flags:['PUNCTUATION_ONLY'],action:'ALLOW'}),
  fixture('META-01','Benign / formatting / metadata',{path:'updated_at',role:'OPERATIONAL_METADATA',patches:[replace(content+'updated_at','2026-10-04T00:00:00Z')],action:'ALLOW'}),
  fixture('META-02','Benign / formatting / metadata',{path:'internal_id',role:'OPERATIONAL_METADATA',patches:[replace(content+'internal_id','SBX-004821')],action:'ALLOW'}),
  fixture('META-03','Benign / formatting / metadata',{path:'source_url',role:'OPERATIONAL_METADATA',basePatch:baseValue('source_url','http://sandbox.istithbat.invalid/records/HAD-4821'),patches:[replace(content+'source_url','https://sandbox.istithbat.invalid/records/HAD-4821')],action:'ALLOW'}),
  fixture('META-04','Benign / formatting / metadata',{path:'display_label',role:'OPERATIONAL_METADATA',patches:[replace(content+'display_label','Synthetic sandbox record HAD-4821')],action:'ALLOW'}),
  fixture('META-05','Benign / formatting / metadata',{path:'description',role:'OPERATIONAL_METADATA',patches:[replace(content+'description','Corrected description of the controlled synthetic record.')],action:'ALLOW'}),

  translation('TRN-01',{basePatch:baseValue('translation','Synthetic test statement: it is not permitted.'),patches:[replace(content+'translation','Synthetic test statement: it is permitted.')]}),
  translation('TRN-02',{basePatch:baseValue('translation','Synthetic test statement: one must review.'),patches:[replace(content+'translation','Synthetic test statement: one may review.')]}),
  translation('TRN-03',{basePatch:baseValue('translation','Synthetic test statement: all cases.'),patches:[replace(content+'translation','Synthetic test statement: some cases.')]}),
  translation('TRN-04',{basePatch:baseValue('translation','Synthetic test statement: one may review.'),patches:[replace(content+'translation','Synthetic test statement: one must review.')]}),
  translation('TRN-05',{basePatch:baseValue('translation','A sentence used for a synthetic test.'),patches:[replace(content+'translation','A synthetic test sentence.')],material:false}),
  translation('TRN-06',{basePatch:baseValue('translation','Synthetic test statement, if condition X holds.'),patches:[replace(content+'translation','Synthetic test statement.')]}),
  provenance('PROV-01',{path:'scholar.display',patches:[replace(content+'scholar/display','Synthetic Evaluator B')]}),
  provenance('PROV-02',{path:'reference.book',patches:[replace(content+'reference/book','Istithbat Sandbox Reference Collection B')]}),
  provenance('PROV-03',{path:'reference.page',patches:[replace(content+'reference/page',13)]}),
  provenance('PROV-04',{path:'narrators[0]',type:'ARRAY_ITEM_REMOVED',patches:[remove(content+'narrators/0')]}),

  judgment('HAD-01',{patches:[replace(content+'judgment','صحيح')]}),
  judgment('HAD-02',{basePatch:baseValue('judgment','إسناده ضعيف'),patches:[replace(content+'judgment','ضعيف')]}),
  judgment('HAD-03',{type:'FIELD_DELETED',patches:[remove(content+'judgment')]}),
  judgment('HAD-04',{basePatch:baseValue('judgment','حسن'),patches:[replace(content+'judgment','صحيح')]}),
  judgment('HAD-05',{basePatch:baseValue('judgment','صحيح'),patches:[replace(content+'judgment','ضعيف')]}),
  provenance('HAD-06',{category:'Hadith / Evidence Drift',path:'scholar.display',patches:[replace(content+'scholar/display','Synthetic Evaluator B')]}),
  provenance('HAD-07',{category:'Hadith / Evidence Drift',path:'reference.book',patches:[replace(content+'reference/book','Istithbat Sandbox Citation B')]}),
  provenance('HAD-08',{category:'Hadith / Evidence Drift',path:'narrators[0]',type:'ARRAY_ITEM_REMOVED',patches:[remove(content+'narrators/0')]}),
  judgment('HAD-09',{basePatch:baseValue('judgment','صحيح بشرط اختباري'),patches:[replace(content+'judgment','صحيح')]}),
  judgment('HAD-10',{patches:[replace(content+'judgment','إسناده\tصحيح')],flags:['WHITESPACE_ONLY'],action:'ALLOW',material:false,minRisk:'LOW',maxRisk:'LOW'}),

  arabic('ARB-01',{basePatch:baseValue('arabic_text','نص تجريبي — لا يجوز (عبارة اختبارية فقط).'),patches:[replace(content+'arabic_text','نص تجريبي — يجوز (عبارة اختبارية فقط).')]}),
  arabic('ARB-02',{basePatch:baseValue('arabic_text','نص تجريبي — خَلَقَ (عبارة اختبارية فقط).'),patches:[replace(content+'arabic_text','نص تجريبي — خُلِقَ (عبارة اختبارية فقط).')],flags:['HARAKAT_ONLY']}),
  arabic('ARB-03',{basePatch:baseValue('arabic_text','نص تجريبي — إذا تحقق الشرط يظهر النص.'),patches:[replace(content+'arabic_text','نص تجريبي — يظهر النص.')]}),
  arabic('ARB-04',{basePatch:baseValue('arabic_text','نص تجريبي — هذا القيد ضروري في الاختبار.'),patches:[replace(content+'arabic_text','نص تجريبي — هذا ضروري في الاختبار.')]}),
  arabic('ARB-05',{basePatch:baseValue('arabic_text','نص تجريبي — ترتيب أول ثم ثان.'),patches:[replace(content+'arabic_text','نص تجريبي — ثان ثم أول ترتيب.')]}),
  translation('DEL-01',{category:'Arabic / deletion / edge',type:'FIELD_DELETED',patches:[remove(content+'translation')]}),
  provenance('DEL-02',{category:'Arabic / deletion / edge',path:'reference.book',type:'FIELD_DELETED',patches:[remove(content+'reference/book')]}),

  arabic('SM-01',{category:'Silent Mutation',sameLabel:true,patches:[replace(content+'arabic_text','نص تجريبي — تغيير واضح في المحتوى الاختباري فقط.')]}),
  fixture('SM-02','Silent Mutation',{sameLabel:true,rawTransform:'reverse-key-order',serializationOnly:true,action:'ALLOW'}),
  judgment('SM-03',{category:'Silent Mutation',base:'had-4821.v14.json',sameLabel:true,patches:[replace(content+'judgment','ضعيف')]}),
];

if(fixtures.length!==40) throw new Error(`Expected 40 fixtures, got ${fixtures.length}`);
const directory=resolve('evaluation/mutations');
mkdirSync(directory,{recursive:true});
for(const item of fixtures) writeFileSync(resolve(directory,`${item.id}.json`),JSON.stringify(item,null,2)+'\n');
