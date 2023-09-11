var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var mkdirp = require('mkdirp');
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
    var _this = this;
    var contentList = args.map(function (fname) { return "@@" + fname + "@@\n" + fileMap[fname] + "@@END@@\n"; });
    // Provides some hint to the files inside:
    var cateditFileName = "catedit_" + args.join('_').replace(/[^a-zA-Z0-9@]/g, '@');
    cateditFileName = cateditFileName.replace("/", "_");
    if (cateditFileName.length > 100) {
        cateditFileName = cateditFileName.substring(0, 10);
    }
    var filePath = path.join(tempDirPath, cateditFileName);
    var extension = "";
    for (var _i = 0, args_2 = args; _i < args_2.length; _i++) {
        var arg = args_2[_i];
        var parts = arg.split('.');
        if (parts.length > 1 && !parts[parts.length - 1].includes("/")) {
            extension = '.' + parts[parts.length - 1];
        }
        break;
    }
    filePath += extension;
    var synthesizedInput = contentList.join('\n');
    fs.writeFileSync(filePath, synthesizedInput);
    launchVim(filePath, function () { return __awaiter(_this, void 0, void 0, function () {
        var finalOutput, newContent, removed, _i, _a, fileToUpdate, existed;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    finalOutput = fs.readFileSync(filePath, 'utf8');
                    // Special case: No writes at all.
                    if (synthesizedInput === finalOutput) {
                        console.log(clc.blackBright("No changes."));
                        return [2 /*return*/];
                    }
                    // Write a backup before fiddling with files:
                    fs.writeFileSync(filePath + ".backup", synthesizedInput);
                    console.log(clc.blackBright("Backup written to " + filePath + ".backup"));
                    newContent = computeNewContents(finalOutput);
                    removed = args;
                    _i = 0, _a = Object.keys(newContent);
                    _b.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 4];
                    fileToUpdate = _a[_i];
                    existed = fs.existsSync(fileToUpdate);
                    removed = removed.filter(function (fname) { return fname !== fileToUpdate; });
                    if (newContent[fileToUpdate] === fileMap[fileToUpdate]) {
                        console.log(clc.blackBright("No changes in " + fileToUpdate));
                        // Elide the write
                        return [3 /*break*/, 3];
                    }
                    return [4 /*yield*/, mkdirp(path.dirname(fileToUpdate))];
                case 2:
                    _b.sent();
                    fs.writeFileSync(fileToUpdate, newContent[fileToUpdate]);
                    if (!existed) {
                        console.log(clc.green("Wrote new file " + fileToUpdate));
                    }
                    else {
                        console.log(clc.yellow("Updated " + fileToUpdate));
                    }
                    _b.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    // We delete files whose entry blocks were removed:
                    deleteRemovedEntries(removed);
                    return [2 /*return*/];
            }
        });
    }); });
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
        if (!fileContents.endsWith('\n')) {
            fileContents += '\n';
        }
        return fileContents;
    }
    catch (err) {
        return '';
    }
}
