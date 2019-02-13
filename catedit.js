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
    synthesizeInputRunEditorParseOutput(dirPath);
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
var fileMap = {};
for (var _i = 0, args_1 = args; _i < args_1.length; _i++) {
    var file = args_1[_i];
    fileMap[file] = readIfExists(file);
}
function synthesizeInputRunEditorParseOutput(tempDirPath) {
    var contentList = args.map(function (fname) { return "@@" + fname + "@@\n" + fileMap[fname] + "@@END@@\n"; });
    // Provides some hint to the files inside:
    var cateditFileName = "catedit_" + args.join('_').replace(/[^a-zA-Z0-9@]/g, '@');
    if (cateditFileName.length > 10) {
        cateditFileName = cateditFileName.substring(0, 10);
    }
    var filePath = path.join(tempDirPath, cateditFileName);
    var extension = "";
    for (var _i = 0, args_2 = args; _i < args_2.length; _i++) {
        var arg = args_2[_i];
        var parts = arg.split('.');
        extension = '.' + parts[parts.length - 1];
        break;
    }
    filePath += extension;
    var synthesizedInput = contentList.join('\n');
    fs.writeFileSync(filePath, synthesizedInput);
    launchVim(filePath, function () {
        // Parse output afterwards:
        var finalOutput = fs.readFileSync(filePath, 'utf8');
        // Special case: No writes at all.
        if (synthesizedInput === finalOutput) {
            console.log(clc.blackBright("No changes."));
            return;
        }
        // Write a backup before fiddling with files:
        fs.writeFileSync(filePath + ".backup", synthesizedInput);
        console.log(clc.blackBright("Backup written to " + filePath + ".backup"));
        var newContent = computeNewContents(finalOutput);
        var removed = args;
        for (var _i = 0, _a = Object.keys(newContent); _i < _a.length; _i++) {
            var fileToUpdate = _a[_i];
            var existed = fs.existsSync(fileToUpdate);
            removed = removed.filter(function (fname) { return fname !== fileToUpdate; });
            if (newContent[fileToUpdate] === fileMap[fileToUpdate]) {
                console.log(clc.blackBright("No changes in " + fileToUpdate));
                // Elide the write
                continue;
            }
            fs.writeFileSync(fileToUpdate, newContent[fileToUpdate]);
            if (!existed) {
                console.log(clc.green("Wrote new file " + fileToUpdate));
            }
            else {
                console.log(clc.yellow("Updated " + fileToUpdate));
            }
        }
        // We delete files whose entry blocks were removed:
        deleteRemovedEntries(removed);
    });
}
function launchVim(filePath, afterVimClosesCallback) {
    var vimInstance = spawn('vim', [filePath], { stdio: 'inherit' });
    vimInstance.on('exit', afterVimClosesCallback);
}
function deleteRemovedEntries(removed) {
    // Remove the removed:
    for (var _i = 0, removed_1 = removed; _i < removed_1.length; _i++) {
        var fileName = removed_1[_i];
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
        var fileContents = fs.readFileSync(fname, 'utf8').toString();
        if (fileContents && fileContents[fileContents.length - 1] != '\n') {
            fileContents += '\n';
        }
        return fileContents;
    }
    catch (err) {
        console.log(err);
        return '';
    }
}
