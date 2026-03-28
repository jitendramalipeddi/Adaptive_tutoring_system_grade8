import fs from 'fs';

let content = fs.readFileSync('src/data/learning_material.json', 'utf8');
console.log('content length:', content.length);
console.log('first 200 chars:', content.substring(0, 200));