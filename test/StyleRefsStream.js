'use strict';

var path = require('path');
var StyleRefsStream = require('../');
var fs = require('fs');

var fixturesDir = path.normalize(__dirname + '/fixtures/');

module.exports = {
        setUp: function(callback)
        {
                callback();
        },
        tearDown: function(callback)
        {
                callback();
        },
        'defaults': function(test)
        {
                var stream = StyleRefsStream();
                test.strictEqual(stream.outputMode, 'import');
                test.strictEqual(stream.pathsRelativeTo, false);
                
                stream = StyleRefsStream({});
                test.strictEqual(stream.outputMode, 'import');
                test.strictEqual(stream.pathsRelativeTo, false);
                
                // absolute is the default, make sure there are not 
                // multiple ways to represent it
                stream = StyleRefsStream({pathsRelativeTo: '/'});
                test.strictEqual(stream.pathsRelativeTo, false);
                
                stream = StyleRefsStream({pathsRelativeTo: '/bla/..'});
                test.strictEqual(stream.pathsRelativeTo, false);
                
                test.done();
        },
        'invalid input': function(test)
        {
                test.throws(function()
                {
                        StyleRefsStream({outputMode: 'qwerty'});
                });
                
                var stream = StyleRefsStream({
                        outputMode: 'concat'
                });
                
                var fooCssFile = fixturesDir + 'foo.css';
                test.ok(fs.existsSync(fooCssFile));
                
                test.throws(function()
                {
                        // concat mode requires a real source
                        stream.end({
                                'id': 'qwerty',
                                'file': fooCssFile,
                                'source': null
                        });
                });
                
                test.done();
        },
        '@import': function(test)
        {
                var stream = StyleRefsStream({
                        outputMode: 'import',
                        pathsRelativeTo: fixturesDir
                });
                var data = '';
                var fooCssFile = fixturesDir + 'foo.css';
                var barCssFile = fixturesDir + 'bar.css';
                
                stream.on('error', function(error)
                {
                        console.log('Error in stream', error, error && error.stack);
                        test.ok(false, 'An error occured within the stream');
                        test.done();   
                });
                
                stream.on('data', function(text)
                {
                        data += text;
                });
                
                stream.on('end', function()
                {
                        test.strictEqual(
                                data, 
                                '@import "foo.css";\n' +
                                '@import "bar.css";\n'
                        );
                });
                
                test.expect(3);
                test.strictEqual(stream.outputMode, 'import');
                
                stream.write({
                        'id': 'qwerty',
                        'file': fooCssFile,
                        'source': null
                });
                
                stream.end({
                        'id': 'blablabla',
                        'file': barCssFile,
                        'source': null
                }, 
                null, 
                function()
                {
                        test.ok(true);
                        test.done();
                });
        },
        '@import absolute': function(test)
        {
                var stream = StyleRefsStream({
                        outputMode: 'import',
                        pathsRelativeTo: false // means absolute
                });
                var data = '';
                var fooCssFile = fixturesDir + 'foo.css';
                
                if (fooCssFile.match(/["'\n\r]/))
                {
                        console.log('Warning: ', fooCssFile, ' contains a weird character that is not handled in the test case');
                }
                
                stream.on('error', function(error)
                {
                        console.log('Error in stream', error, error && error.stack);
                        test.ok(false, 'An error occured within the stream');
                        test.done();   
                });
                
                stream.on('data', function(text)
                {
                        data += text;
                });
                
                stream.on('end', function()
                {
                        test.strictEqual(
                                data, 
                                '@import "'+fooCssFile.replace(/\\/g, '\\\\')+'";\n'
                        );
                });
                
                test.expect(2);
                
                stream.end({
                        'id': 'qwerty',
                        'file': fooCssFile,
                        'source': null
                }, 
                null, 
                function()
                {
                        test.ok(true);
                        test.done();
                });
        },
        'concat': function(test)
        {
                var stream = StyleRefsStream({
                        outputMode: 'concat'
                });
                var data = '';
                var fooCssFile = fixturesDir + 'foo.css';
                var barCssFile = fixturesDir + 'bar.css';
                
                stream.on('error', function(error)
                {
                        console.log('Error in stream', error, error && error.stack);
                        test.ok(false, 'An error occured within the stream');
                        test.done();   
                });
                
                stream.on('data', function(text)
                {
                        data += text;
                });
                
                stream.on('end', function()
                {
                        data = data.replace(/\r\n?/g, '\n');
                        test.strictEqual(
                                data, 
                                '/* foo.css */\n' +
                                '/* This will cause a syntax error if it is included as a node module */\n'+
                                'body {\n'+
                                '        background: red;\n'+
                                '}\n' +
                                '/* bar.css */\n'+
                                '/* This will cause a syntax error if it is included as a node module */\n'+
                                '.bar {\n'+
                                '        background: green;\n'+
                                '}\n'
                        );
                });
                
                test.expect(3);
                test.strictEqual(stream.outputMode, 'concat');
                
                stream.write({
                        'id': 'qwerty',
                        'file': fooCssFile,
                        'source': fs.readFileSync(fooCssFile, 'utf8')
                });
                
                stream.end({
                        'id': 'blablabla',
                        'file': barCssFile,
                        'source': fs.readFileSync(barCssFile, 'utf8')
                }, 
                null, 
                function()
                {
                        test.ok(true);
                        test.done();
                });
        }
};