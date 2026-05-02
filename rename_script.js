const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
    fs.readdirSync(dir).forEach(file => {
        if (file === 'node_modules' || file.endsWith('.db') || file.endsWith('.png') || file.endsWith('.jpg') || file === '.git' || file === 'package-lock.json' || file.startsWith('sevaone.db')) return;
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            filelist = walkSync(filepath, filelist);
        } else {
            if (filepath.endsWith('.html') || filepath.endsWith('.js') || filepath.endsWith('.md')) {
                filelist.push(filepath);
            }
        }
    });
    return filelist;
};

const files = walkSync(path.join(__dirname, 'sevaone'));

files.forEach(file => {
    try {
        let content = fs.readFileSync(file, 'utf8');
        let originalContent = content;
        
        // Logos / text
        content = content.replace(/Seva\s*<span style="color:#f39c12">One<\/span>/g, 'Jana <span style="color:#f39c12">Seva</span>');
        content = content.replace(/SevaOne(?:[\s]+)<span style="color:#f39c12">Admin<\/span>/g, 'JanaSeva <span style="color:#f39c12">Admin</span>');
        
        content = content.replace(/SevaOne/g, 'JanaSeva');
        content = content.replace(/Seva One/g, 'Jana Seva');
        content = content.replace(/sevaone/g, 'janaseva');
        
        if (content !== originalContent) {
            fs.writeFileSync(file, content, 'utf8');
            console.log(`Updated ${file}`);
        }
    } catch (e) {
        console.error(`Error with ${file}:`, e);
    }
});
console.log('Renaming complete!');
