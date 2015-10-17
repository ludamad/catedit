var temp = require('temp');
var fs = require('fs');
var _a = require('child_process'), exec = _a.exec, spawn = _a.spawn;
var args = process.argv.map(function (s) { return s; });
args.shift();
args.shift(); // Pop front two arguments
temp.track();
function computeNewContents(fileContent) {
    var currentFileName = null;
    var buffer = [];
    var newContents = {};
    for (var _i = 0, _a = fileContent.split('\n'); _i < _a.length; _i++) {
        var line = _a[_i];
        var endMatch = line.match(/^\s*@@\s*END\s*@@\s*$/);
        if (endMatch) {
            newContents[currentFileName] = buffer.join('\n') + '\n';
            currentFileName = null;
            buffer = [];
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
function readIfExists(fname) {
    try {
        return fs.readFileSync(fname, 'utf8');
    }
    catch (err) {
        return '';
    }
}
temp.open('catedit', function (err, info) {
    if (!err) {
        var contentList = args.map(function (fname) { return ("@@" + fname + "@@\n" + readIfExists(fname) + "@@END@@\n\n"); });
        for (var _i = 0; _i < contentList.length; _i++) {
            var content = contentList[_i];
            fs.writeSync(info.fd, content);
        }
        fs.close(info.fd, function () {
            var vimInstance = spawn('vim', [info.path, '-c', 'silent set filetype=typescript'], { stdio: 'inherit' });
            vimInstance.on('exit', function () {
                var fileContent = fs.readFileSync(info.path, 'utf8');
                var newContent = computeNewContents(fileContent);
                var missing = args; //copy
                for (var _i = 0, _a = Object.keys(newContent); _i < _a.length; _i++) {
                    var key = _a[_i];
                    // TODO delete files no longer mentioned?
                    fs.writeFileSync(key, newContent[key]);
                    missing = missing.filter(function (fname) { return fname !== key; });
                }
                // Remove the missing:
                for (var _b = 0, _c = missing; _b < _c.length; _b++) {
                    var key_1 = _c[_b];
                    try {
                        fs.unlinkSync(key_1);
                    }
                    catch (err) {}
                }
            });
        });
    }
});
