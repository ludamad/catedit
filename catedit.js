var fs = require('fs');
var temp = require('temp');
var path = require('path');
var clc = require('cli-color');
var _a = require('child_process'), exec = _a.exec, spawn = _a.spawn;
var args = process.argv.map(function (s) { return s; });
args.shift();
args.shift(); // Pop front two arguments
temp.mkdir('catedit', function (err, dirPath) {
    if (err)
        throw err;
    combineInputIntoTemporaryFile(dirPath);
});
// Helper functions from here out
function computeNewContents(fileContent) {
    var currentFileName = null;
    var buffer = [];
    var newContents = {};
    for (var _i = 0, _a = fileContent.split('\n'); _i < _a.length; _i++) {
        var line = _a[_i];
        var endMatch = line.match(/^\s*@@\s*END\s*@@\s*$/);
        if (endMatch) {
            newContents[currentFileName] = buffer.join('\n') + '\n';
            buffer = [];
            currentFileName = null;
            continue;
        }
        var match = line.match(/^\s*@@\s*(.+)\s*@@\s*$/);
        if (match) {
            currentFileName = match[1];
        }
        else if (currentFileName !== null) {
            buffer.push(line);
        }
    }
    return newContents;
}
function combineInputIntoTemporaryFile(tempDirPath) {
    var contentList = args.map(function (fname) { return ("@@" + fname + "@@\n" + readIfExists(fname) + "@@END@@\n"); });
    // Provides some hint to the files inside:
    var cateditFileName = "catedit_" + args.join('_').replace(/[^a-zA-Z0-9@]/g, '@');
    if (cateditFileName.length > 25) {
        cateditFileName = cateditFileName.substring(0, 22) + '...';
    }
    var filePath = path.join(tempDirPath, cateditFileName);
    fs.writeFileSync(filePath, contentList.join('\n'));
    launchVim(filePath);
}
function launchVim(filePath) {
    var vimInstance = spawn('vim', [filePath, '-c', 'silent set filetype=typescript'], { stdio: 'inherit' });
    function afterVimCloses() {
        updateFilesAccordingToChanges(filePath);
    }
    vimInstance.on('exit', afterVimCloses);
}
function updateFilesAccordingToChanges(filePath) {
    var fileContent = fs.readFileSync(filePath, 'utf8');
    var newContent = computeNewContents(fileContent);
    var removed = args; //copy
    for (var _i = 0, _a = Object.keys(newContent); _i < _a.length; _i++) {
        var key = _a[_i];
        var existed = fs.existsSync(key);
        // We delete files no longer mentioned
        fs.writeFileSync(key, newContent[key]);
        removed = removed.filter(function (fname) { return fname !== key; });
        if (!existed) {
            console.log(clc.green("Wrote new file '" + key + "'."));
        }
        else {
            console.log(clc.yellow("Updated '" + key + "'."));
        }
    }
    deleteRemovedEntries(removed);
}
function deleteRemovedEntries(removed) {
    // Remove the removed:
    for (var _i = 0; _i < removed.length; _i++) {
        var fileName = removed[_i];
        try {
            fs.unlinkSync(fileName);
            console.log(clc.red("Deleted '" + fileName + "'."));
        }
        catch (err) {
            console.log(clc.blackBright("Nothing to write with '" + fileName + "'."));
        }
    }
}
function readIfExists(fname) {
    try {
        return fs.readFileSync(fname, 'utf8');
    }
    catch (err) {
        return '';
    }
}
