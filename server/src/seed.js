import { db } from './db.js';
import { hashPassword } from './auth.js';

// Seed default users if none exist or admin missing
const addUser = db.prepare('INSERT OR IGNORE INTO users(name,email,password,role) VALUES(?,?,?,?)');
const adminId = addUser.run('Platform Admin', 'admin@circle.com', hashPassword('admin123'), 'admin').lastInsertRowid;
const sellerInfo = addUser.run('Demo Seller', 'seller@circle.com', hashPassword('seller123'), 'user');
const buyerInfo = addUser.run('Demo Customer', 'customer@circle.com', hashPassword('customer123'), 'user');

const sellerUser = db.prepare("SELECT id FROM users WHERE email='seller@circle.com'").get();
const buyerUser = db.prepare("SELECT id FROM users WHERE email='customer@circle.com'").get();

console.log('Seeded accounts ready with bcrypt encryption.');

const hasData = db.prepare('SELECT count(*) count FROM categories').get().count;
if (hasData) {
  // Update any existing null image_url or missing user_id on seeded listings
  if (sellerUser?.id) {
    db.prepare("UPDATE listings SET user_id=? WHERE user_id IS NULL").run(sellerUser.id);
  }
  db.prepare("UPDATE listings SET image_url='https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1100&q=85' WHERE image_url IS NULL AND title LIKE '%iPhone%'").run();
  console.log('Database already seeded. Ensured seller links and image URLs are updated.');
  process.exit();
}

const addCategory = db.prepare('INSERT INTO categories(name,slug,description,icon) VALUES(?,?,?,?)');
const addField = db.prepare('INSERT INTO fields(key,label,type,options_json,rules_json,placeholder,help_text) VALUES(?,?,?,?,?,?,?)');
const attach = db.prepare('INSERT INTO category_fields(category_id,field_id,position,required,conditional_json) VALUES(?,?,?,?,?)');

const categories = {
  phone: addCategory.run('Mobile Phones','mobile-phones','Smartphones and feature phones','▣').lastInsertRowid,
  laptop: addCategory.run('Laptops','laptops','Portable computers','⌘').lastInsertRowid,
  sofa: addCategory.run('Sofas','sofas','Comfortable seating for home','▰').lastInsertRowid
};

const fields = {};
function field(key,label,type,options=[],rules={},placeholder='',help='') {
  fields[key] = addField.run(key,label,type,JSON.stringify(options),JSON.stringify(rules),placeholder,help).lastInsertRowid;
}

field('brand','Brand','text',[],{minLength:2,maxLength:40},'e.g. Apple','Manufacturer or brand name');
field('model','Model','text',[],{minLength:1,maxLength:60},'e.g. iPhone 13','Specific model name');
field('storage','Storage','select',['64 GB','128 GB','256 GB','512 GB','1 TB'],{},'Select storage capacity');
field('ram','RAM','select',['4 GB','6 GB','8 GB','12 GB','16 GB','32 GB']);
field('original_box','Original box','radio',['Yes','No']);
field('battery_health','Battery health','number',[],{min:1,max:100},'e.g. 87','Battery health percentage (1-100)');
field('processor','Processor','text',[],{maxLength:80},'e.g. Apple M2');
field('graphics','Graphics card','text',[],{maxLength:80},'e.g. NVIDIA RTX 4060');
field('material','Material','select',['Fabric','Leather','Velvet','Wood','Other']);
field('seats','Seating capacity','select',['2 seater','3 seater','4+ seater']);
field('pet_friendly','Pet friendly','radio',['Yes','No'],{default:'No'});
field('dimensions','Dimensions','text',[],{maxLength:80},'W × D × H, e.g. 210 × 90 × 85 cm');
field('color','Color','text',[],{maxLength:30},'e.g. Midnight Blue','Primary color of the item');
field('purchase_year','Purchase year','number',[],{min:1990,max:new Date().getFullYear()},'e.g. 2022','Year the item was originally purchased');
field('purchase_date','Purchase date','date',[],{},'','The date you originally bought this item');
field('known_issues','Known issues / notes','textarea',[],{maxLength:500},'Any wear, defects, or quirks a buyer should know about');
field('under_warranty','Under warranty','radio',['Yes','No']);
field('warranty_expiry','Warranty expiry','date');
field('accessories','Accessories included','checkbox',['Charger','Case','Manual','Receipt']);

function map(cat, keys) {
  keys.forEach(([key,required,conditional],position) => 
    attach.run(categories[cat],fields[key],position,Number(!!required),conditional ? JSON.stringify(conditional) : null)
  );
}

map('phone',[
  ['brand',true],
  ['model',true],
  ['storage',true],
  ['ram',false],
  ['color',false],
  ['original_box',false],
  ['battery_health',false],
  ['purchase_date',false],
  ['under_warranty',false],
  ['warranty_expiry',false,{fieldKey:'under_warranty',equals:'Yes'}],
  ['accessories',false],
  ['known_issues',false]
]);

map('laptop',[
  ['processor',true],
  ['ram',true],
  ['storage',true],
  ['graphics',false],
  ['color',false],
  ['battery_health',false],
  ['purchase_date',false],
  ['under_warranty',false],
  ['warranty_expiry',false,{fieldKey:'under_warranty',equals:'Yes'}],
  ['known_issues',false]
]);

map('sofa',[
  ['material',true],
  ['seats',true],
  ['color',false],
  ['pet_friendly',false],
  ['dimensions',true],
  ['purchase_date',false],
  ['known_issues',false]
]);

const listing = db.prepare('INSERT INTO listings(user_id,category_id,title,description,price,condition,location,image_url) VALUES(?,?,?,?,?,?,?,?)')
  .run(sellerUser?.id || 1, categories.phone,'iPhone 13, 128 GB','Clean, fully functional phone. Includes its original box and charging cable.',3499900,'Excellent','Bengaluru','https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1100&q=85')
  .lastInsertRowid;

for (const [key,val] of Object.entries({brand:'Apple',model:'iPhone 13',storage:'128 GB',original_box:'Yes',battery_health:88,accessories:['Charger','Case']})) {
  db.prepare('INSERT INTO listing_attributes(listing_id,field_id,value_json) VALUES(?,?,?)').run(listing,fields[key],JSON.stringify(val));
}

console.log('Seeded default admin, categories, field definitions, and sample listing.');
