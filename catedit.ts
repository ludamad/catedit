declare var require, process;

var fs = require('fs');
var temp = require('temp');
var path = require('path');
var clc = require('cli-color');
var {exec,spawn}   = require('child_process');

var args = process.argv.map(s => s); args.shift(); args.shift(); // Pop front two arguments

temp.mkdir('catedit', (err,dirPath) => {
    if (err) throw err;
    combineInputIntoTemporaryFile(dirPath);
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

function combineInputIntoTemporaryFile(tempDirPath) {
    let contentList:string[] = args.map(fname => `@@${fname}@@\n${readIfExists(fname)}@@END@@\n`);
    // Provides some hint to the files inside:
    let cateditFileName = "catedit_" + args.join('_').replace(/[^a-zA-Z0-9@]/g, '@');
    if (cateditFileName.length > 25) {
        cateditFileName = cateditFileName.substring(0, 22) + '...';
    }
    let filePath = path.join(tempDirPath, cateditFileName);
    fs.writeFileSync(filePath, contentList.join('\n'));
    launchVim(filePath)
}

function launchVim(filePath) {
    let vimInstance = spawn('vim', [filePath, '-c', 'silent set filetype=typescript'], { stdio: 'inherit' });
    function afterVimCloses() {
        updateFilesAccordingToChanges(filePath);
    }
    vimInstance.on('exit', afterVimCloses);
}

function updateFilesAccordingToChanges(filePath) {
    let fileContent = fs.readFileSync(filePath, 'utf8');
    let newContent = computeNewContents(fileContent);
    let removed = args; //copy
    for (var key of Object.keys(newContent)) {
        let existed = fs.existsSync(key);
        // We delete files no longer mentioned
        fs.writeFileSync(key, newContent[key]);
        removed = removed.filter(fname => fname !== key);
        if (!existed) {
            console.log(clc.green(`Wrote new file '${key}'.`));
        } else {
            console.log(clc.yellow(`Updated '${key}'.`));
        }
    }
    deleteRemovedEntries(removed);
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
        return fs.readFileSync(fname, 'utf8');
    } catch (err) {
        return '';
    }
}


