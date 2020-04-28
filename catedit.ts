declare var require, process;

const mkdirp = require('mkdirp');
var fs = require('fs');
var temp = require('temp');
var path = require('path');
var clc = require('cli-color');
var {exec,spawn}   = require('child_process');

var args = process.argv.map(s => s); args.shift(); args.shift(); // Pop front two arguments

temp.mkdir('catedit', (err,dirPath) => {
    if (err) throw err;
    synthesizeInputRunEditorParseOutput(dirPath);
})

// Helper functions from here out

function computeNewContents(fileContent) {
    let currentFileName = null;
    let buffer = [];
    let newContents = {};
    for (let line of fileContent.split('\n')) {
        let endMatch = line.match(/^\s*@@\s*END\s*@@\s*$/);
        if (endMatch) {
            newContents[currentFileName] = buffer.join('\n') + '\n';
            buffer = [];
            currentFileName = null;
            continue;
        }
        let match = line.match(/^\s*@@\s*(.+)\s*@@\s*$/);
        if (match) { 
            currentFileName = match[1];
        } else if (currentFileName !== null) {
            buffer.push(line);
        }
    }
    return newContents;
}

let fileMap = {};
for (let file of args) {
    fileMap[file] = readIfExists(file);
}

function synthesizeInputRunEditorParseOutput(tempDirPath) {
    let contentList:string[] = args.map(fname => `@@${fname}@@\n${fileMap[fname]}@@END@@\n`);
    // Provides some hint to the files inside:
    let cateditFileName = "catedit_" + args.join('_').replace(/[^a-zA-Z0-9@\/]/g, '@');
    if (cateditFileName.length > 10) {
        cateditFileName = cateditFileName.substring(0, 10);
    }
    let filePath = path.join(tempDirPath, cateditFileName);

    let extension = "";
    for (let arg of args) {
        let parts = arg.split('.');
        extension = '.' + parts[parts.length - 1];
        break;
    }
    filePath += extension;

    let synthesizedInput = contentList.join('\n');
    fs.writeFileSync(filePath, synthesizedInput);
    launchVim(filePath, async () => {
        // Parse output afterwards:
        let finalOutput = fs.readFileSync(filePath, 'utf8');
        // Special case: No writes at all.
        if (synthesizedInput === finalOutput) { 
            console.log(clc.blackBright(`No changes.`));
            return;
        }

        // Write a backup before fiddling with files:
        fs.writeFileSync(`${filePath}.backup`, synthesizedInput);
        console.log(clc.blackBright(`Backup written to ${filePath}.backup`))
        let newContent = computeNewContents(finalOutput);
        let removed = args; 
        for (var fileToUpdate of Object.keys(newContent)) {
            let existed = fs.existsSync(fileToUpdate);
            removed = removed.filter(fname => fname !== fileToUpdate);
            if (newContent[fileToUpdate] === fileMap[fileToUpdate]) {
                console.log(clc.blackBright(`No changes in ${fileToUpdate}`));
                // Elide the write
                continue;
            }
            await mkdirp(path.dirname(fileToUpdate));
            fs.writeFileSync(fileToUpdate, newContent[fileToUpdate]);
            if (!existed) {
                console.log(clc.green(`Wrote new file ${fileToUpdate}`));
            } else {
                console.log(clc.yellow(`Updated ${fileToUpdate}`));
            }
        }
        // We delete files whose entry blocks were removed:
        deleteRemovedEntries(removed);
    });
}

function launchVim(filePath, afterVimClosesCallback) {
    let vimInstance = spawn('vim', [filePath], { stdio: 'inherit' });
    vimInstance.on('exit', afterVimClosesCallback);
}
function deleteRemovedEntries(removed) {
    // Remove the removed:
    for (let fileName of removed) {
        try { fs.unlinkSync(fileName); console.log(clc.red(`Deleted '${fileName}'.`)); } 
        catch(err){ console.log(clc.blackBright(`Nothing to write with '${fileName}'.`));}
    }
}

function readIfExists(fname) {
    try {
        let fileContents = fs.readFileSync(fname, 'utf8').toString();
        if (!fileContents.endsWith('\n')) {
            fileContents += '\n';
        }
        return fileContents;
    } catch (err) {
        return '';
    }
}


