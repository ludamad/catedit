declare var require, process;

var temp = require('temp');
var fs = require('fs');
var {exec,spawn}   = require('child_process');

var args = process.argv.map(s => s); args.shift(); args.shift(); // Pop front two arguments
temp.track();

function computeNewContents(fileContent) {
    let currentFileName = null;
    let buffer = [];
    let newContents = {};
    for (let line of fileContent.split('\n')) {
        let endMatch = line.match(/^\s*\/\/\s*@END@\s*$/);
        if (endMatch) {
            newContents[currentFileName] = buffer.join('\n') + '\n';
            buffer = [];
            continue;
        }
        let match = line.match(/^\s*\/\/\s*@@\s*(.+)\s*$/);
        if (match) { 
            currentFileName = match[1];
        } else {
            buffer.push(line);
        }
    }
    return newContents;
}

function readIfExists(fname) {
    try {
        return fs.readFileSync(fname, 'utf8');
    } catch (err) {
        return '';
    }
}

temp.open('catedit', (err,info) => {
    if (!err) {
        var contentList:string[] = args.map(fname => `//@@${fname}\n${readIfExists(fname)}//@END@\n`);
        for (let content of contentList) {
            fs.writeSync(info.fd, content);
        }
        fs.close(info.fd, () => {
            let vimInstance = spawn('vim', [info.path, '+'], {stdio: 'inherit'});
            vimInstance.on('exit', () => {
                let fileContent = fs.readFileSync(info.path, 'utf8');
                let newContent = computeNewContents(fileContent);
                let missing = args; //copy
                for (var key of Object.keys(newContent)) {
                    // TODO delete files no longer mentioned?
                    fs.writeFileSync(key, newContent[key]);
                    missing = missing.filter(fname => fname !== key);
                }
                // Remove the missing:
                for (let key of Object.keys(missing)) {
                    try { fs.unlinkSync(key); } catch(err){}
                }
            });
        });
        
    }
});
