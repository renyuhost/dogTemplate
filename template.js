/*
 * @desc 模板引擎
 * */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(factory);
    } else if (typeof exports === 'object') {
        // Node, CommonJS
        module.exports = factory();
    } else {
        root.template = factory(root);
    }
}(this, function () {
    var template = function(id, data, targetId, options){
            return templ(id, data, targetId, options);
        },

    //默认配置
        defaults = {
            tagStart : '{{',//逻辑语法开始标签
            tagEnd : '}}',//逻辑语法结束标签
            cache : true,//模板缓存
            debug : false
        };

    //工具
    var $utils = {
        $el : $el,
        each : each,
        trim : trim,
        ajax : ajax,
        getTpl : getTpl,
        include : include,
        print : print,
        isPlainObject : isPlainObject,
        isArray : isArray,
        isString : isString,
        isDOM : isDOM
    };

    //缓存
    var $cache = {};

    //渲染
    template.render = render;

    //编译函数
    template.compile = compile;

    //配置
    template.config = function(name, value){
        var config = {};
        if(!isPlainObject(name)){
            config[name] = value;
        }
        for(var i in config){
            if(defaults.hasOwnProperty(i)) defaults[i] = config[i];
        }
    };

    //标签添加
    template.taglib = function(name, tag){
        $taglibs[name] = tag;
    };

    //管道函数添加
    template.helper = function(name, fn){
        $helpers[name] = fn;
    };

    //工具函数
    template.utils = $utils;

    //模板渲染
    function templ(id, data, targetId, options){
        var el, tpl, html = '',
            targetEl = isDOM(targetId) ? targetId : $el(targetId);

        if(isString(id)){
            tpl = getTpl(id);
        }else if(isDOM(id)){
            tpl = trim(el.innerHTML || '');
        }

        if(tpl){
            var render = compile(tpl);
            if(isPlainObject(data)){
                html = render(data, options);
                if(targetEl) targetEl.innerHTML = html;
            }else return render;
        }
        return html;
    }

    //编译函数
    function compile(tpl){
        isString(tpl) ? tpl : '';
        var Render = tplEngine(tpl);
        // 对编译结果进行一次包装
        function render (data, options) {
            data = isPlainObject(data) ? data : {data :data};
            try {
                return new Render(data, options) + '';
            } catch (e) {
                throw(e);
            }
        }
        return render;
    }

    //渲染
    function render(tpl, data){
        data = isPlainObject(data) ? data : {};
        var r = compile(tpl);
        return r(data);
    }

    //模板引擎
    function tplEngine(tpl, options) {
        var opts = isPlainObject(options) ? options : defaults;
        options = {};
        for(var i in defaults){
            options[i] = defaults[i];
            if(opts.hasOwnProperty(i)) options[i] = opts[i];
        }
        options.tagStart = formateTag(options.tagStart);
        options.tagEnd = formateTag(options.tagEnd);

        var reg = new RegExp(options.tagStart + '(.*?)' + options.tagEnd, 'g'),
            funcCode = '', varCode = 'var ', compileCode = '_tpl=[];',
            uniq = {$data:1,$options:1,$utils:1,$helpers:1,_tpl:1,$print:1};
        //函数预定义
        funcCode = funcDefine();

        //代码编译
        compileCode += _compile(tpl);
        compileCode += 'return new String(_tpl.join(""));';
        if(options.debug && console) console.log(funcCode + varCode + compileCode);

        var render = new Function('$data', '$options', (funcCode + varCode + compileCode).replace(/[\r\t\n]/g, ''));
        render.prototype.$taglibs = $taglibs;
        render.prototype.$helpers = $helpers;
        render.prototype.$utils = $utils;
        return render;

        //编译
        function _compile(tpl){
            var arr = tpl.split(options.tagStart), temps = [], list = [];
            if(arr.length > 1){
                for(var i = 0; i < arr.length;){
                    var $0 = arr[i].split(options.tagEnd), $1,
                        startHtml, endHtml, code;

                    if($0.length > 1){
                        code = $0[0];
                        startHtml = '';
                        endHtml = encodeHtml($0[1]);
                        i += 1;
                    }else{
                        $1 = arr[i + 1].split(options.tagEnd);
                        startHtml = encodeHtml($0[0]);
                        endHtml = encodeHtml($1[1]);
                        code = $1[0];
                        i += 2;
                    }

                    temps.push({
                        startHtml : startHtml,
                        endHtml : endHtml,
                        code : code
                    });

                    // 提取模板中的变量名
                    each(getVariable(code), function (name) {
                        // name 值可能为空
                        if (!name || uniq[name]) {
                            return;
                        }

                        var value;
                        // 声明模板变量
                        // 赋值优先级:
                        // $helpers > data
                        if (isTag(name)) {
                            return true;
                        }else if ($helpers[name]) {
                            value = "$helpers." + name;
                        } else {
                            value = "$data." + name;
                        }

                        varCode += name + "=" + value + ",";
                        uniq[name] = true;
                    });
                }

                for(var i = 0; i < temps.length; i++){
                    temps[i].code = tagPair(temps[i].code);
                    list.push('_tpl.push("' + temps[i].startHtml +  '");');
                    list.push(temps[i].code);
                    list.push('_tpl.push("' + temps[i].endHtml +  '");');
                }
            }else{
                list = ['_tpl.push("' + encodeHtml(arr[0]) + '");'];
            }

            return list.join('');
        }
    }

    //管道函数
    var $helpers = {
        substr : function(str, n){
            str = String(str);
            var newStr = str.substr(0, n), len = str.length;
            if(len > n) newStr += '...';
            return newStr;
        }
    };

    //引擎标签
    var $taglibs = {
        'print' : {
            //编译函数
            startCompile : function(html){
                var nodes = trim(html).split(/\s+/);
                html = '$print(' + nodes[1] + ', ' + nodes[2] + ');';
                return html;
            },

            //编译函数
            endCompile : function(html){
                return '';
            },

            //内部编译函数
            code : {
                $print : print
            }
        },
        'if' : {
            //编译函数
            startCompile : function(html){
                html = trim(html).replace(/if/i, 'if(');
                html += '){';
                return html;
            },

            //编译函数
            endCompile : function(html){
                html = html.replace(this.endReg, '}');
                return html;
            },

            //子标签
            subTags : {
                'elseif' : {
                    //编译函数
                    startCompile : function(html){
                        html = trim(html).replace(/elseif/i, '}else if(');
                        html += '){';
                        return html;
                    }
                },

                'else' : {
                    //编译函数
                    startCompile : function(html){
                        html = trim(html).replace(/else/i, '}else');
                        html += '{';
                        return html;
                    }
                }
            }
        },

        'each' : {
            //开始编译函数
            startCompile : function(html){
                var nodes = trim(html).split(/\s+/);
                html = '$each(' + nodes[1] + ',function(' + (nodes[3] || '$value') + ', ' + (nodes[4] || '$index') + '){';
                return html;
            },

            //结尾编译函数
            endCompile : function(html){
                html = html.replace(this.endReg, '});');
                return html;
            },

            //内部编译函数
            code : {
                $each : each
            }
        },

        'include' : {
            //开始编译函数
            startCompile : function(html){
                var nodes = trim(html).split(/\s+/);
                var url = /url\s*=\s*(\S*)/.exec(html);
                url = ((url && url[1]) || '').replace(/'|"/g, '');
                html = '_tpl.push($include(' + nodes[1] + ', ' + nodes[2] + '||$data, {url:"' + url + '"}));';
                return html;
            },

            //结尾编译函数
            endCompile : function(html){
                return '';
            },

            //内部编译函数
            code : {
                $include : include
            }
        }
    };

    //标签适配
    function tagPair(html, tags){
        tags = tags || $taglibs;

        //查找匹配标签
        var matchTag = false;
        for(var m in tags){
            matchTag = pair(html, m, tags[m]);
            if(matchTag) break;
        }

        //编译
        if(matchTag && matchTag.compile){
            html = formateTag(html, true);
            html =  matchTag.compile(html);
        }else{
            html = outputCompile(html);
        }

        //标签遍历匹配
        function pair(html, name, tag){
            var startReg = tag.startReg || new RegExp('^\\s*' + name + '\\s*', 'i'),
                endReg = tag.endReg || new RegExp('^\\/\\s*' + name + '\\s*|^\\s*' + name + '\\s*\\/', 'i'),
                startCheckReg = tag.startCheckReg || new RegExp('^\\s*' + name + '\\S+\\s*', 'i'),
                endCheckReg = tag.endCheckReg || new RegExp('^\\/\\s*' + name + '\\S+\\s*|^\\s*' + name + '\\S+\\s*\\/', 'i'),
                _compile = false;
            tag.startReg = startReg;
            tag.endReg = endReg;
            tag.startCheckReg = startCheckReg;
            tag.endCheckReg = endCheckReg;

            //逻辑代码
            if(endReg.test(html) && !endCheckReg.test(html)){
                _compile = tag.endCompile;
            }else if(startReg.test(html) && !startCheckReg.test(html)){
                _compile = tag.startCompile;
            }
            //子标签
            else if(tag.subTags){
                for(var i in tag.subTags){
                    var subtag = pair(html, i, tag.subTags[i]);
                    if(subtag){
                        return subtag;
                    }
                }
            }
            tag.compile = _compile;

            return _compile ? tag : _compile;
        }

        return html;
    }

    //输出代码编译
    function outputCompile(code){
        code = trim(code);
        if(/.+?\|\s*[\w_]+(\:.+)*/.test(code)){
            var codeArr = code.split(/\s*\|\s*|\s*\:\s*/);
            if($helpers[codeArr[1]]){
                code = codeArr[1] + '(' + codeArr[0];
                for(var i = 2; i < codeArr.length; i++){
                    code += ',' + codeArr[i];
                }
                code += ')';
            }else code = codeArr[0];
            code = '_tpl.push(' + encodeHtml(code) + ');';
        }else{
            code = '_tpl.push(' + encodeHtml(code) + ');';
        }

        return code;
    }

    //编译函数定义
    function funcDefine(){
        var s = 'var $taglibs=this.$taglibs,$helpers=this.$helpers';
        loop($taglibs, '$taglibs');
        s += ';';

        //标签遍历
        function loop(tags, pre){
            pre = pre || '';
            for(var m in tags){
                if(isPlainObject(tags[m].code)){
                    var code = tags[m].code;
                    for(var n in code){
                        if(typeof code[n] == 'function'){
                            s += ',' + n + '=' + pre + '["' + m + '"]["code"]["' + n + '"]';
                        }
                    }
                }
                if(isPlainObject(tags[m].subTags)){
                    loop(tags[m].subTags, pre + '["' + m + '"]["subTags"]');
                }
            }
        }

        return s;
    }

    //转译代码标签
    function encodeHtml(html){
        return html.replace(/"/g, '\\"');
    }

    //格式化标签
    function formateTag(str, reverse){
        var tags = [
            ['<', '&lt;'],
            ['>', '&gt;'],
            ['&', '&amp;']
        ], m = 0, n = 1;

        if(reverse == true){
            n = 0;
            m = 1;
        }
        for(var i = 0; i < tags.length; i++){
            var reg = new RegExp(tags[i][m], 'g');
            str = str.replace(reg, tags[i][n]);
        }

        return str;
    }

    //标签检测
    function isTag(name){
        var b = loop($taglibs, name);
        //标签遍历
        function loop(tags, name){
            var b = false;
            for(var m in tags){
                if(m == name){
                    b = true;
                    break;
                }
                else if(isPlainObject(tags[m].subTags)){
                    b = loop(tags[m].subTags, name);
                    if(b) break;
                }
            }
            return b;
        }

        return b;
    }

    //去除头尾空格
    function trim(str){
        return str.replace(/^\s+|\s+$/g, '');
    }

    //打印
    function print(str){
        if(console) console.log(str);
        else{
            alert(str);
        }
    }

    //遍历
    function each(data, fn){
        var i, len;
        if (isArray(data)) {
            for (i = 0, len = data.length; i < len; i++) {
                fn.call(data, data[i], i, data);
            }
        } else {
            for (i in data) {
                fn.call(data, data[i], i);
            }
        }
    }

    //导入
    function include(id, data, options){
        var html = '';
        options = isPlainObject(options) ? options : {};
        if(isString(id)){
            var innerHTML = getTpl(id);
            if(innerHTML !== false){
                html = getHtml(innerHTML, data, options);
            }
            //远程加载
            else{
                var tid = 'tpl_' + String(Math.random()).replace('.', '');
                html = '<span id="' + tid + '"></span>';
                ajax({
                    url : id,
                    success : function(text){
                        innerHTML = getTpl(id, text);
                        html = getHtml(innerHTML, data, options);
                        check(tid, html, 0);
                    }
                });
            }
        }

        return html;

        function getHtml(tpl, data, options){
            var html = '', render = compile(trim(tpl));
            //远程数据
            if(options.url){
                ajax({
                    url : options.url,
                    async : false,
                    success : function(text){
                        text = text.replace(/[\n\r\f\t\v]/g, '');
                        var data = text;
                        if(/^\s*[\[\{].*[\}\]]\s*$/.test(text)){
                            try{
                                data = (new Function("return " + text))();
                                data = isArray(data) ? data : (data = data || {},!isEmpty(data.data) ? data.data : data);
                            }catch(e){
                                data = {};
                            }
                        }
                        html = render(data, options);
                    }
                });
            }else if(isPlainObject(data)) {
                html = render(data, options);
            }
            return html;
        }

        function check(tid, html, n){
            var el = $el(tid);
            if(el){
                el.innerHTML = html;
            }else{
                if(n > 200) return;
                setTimeout(function(){
                    n += 1;
                    check(tid, html, n);
                }, 20);
            }
        }
    }

    //ajax请求
    function ajax(options){
        options = options || {};
        options.type = (options.type || "GET").toUpperCase();
        options.dataType = (options.dataType || "text").toLowerCase();
        options.async = options.async === false ? false : true;

        //创建 - 非IE6 - 第一步
        if (window.XMLHttpRequest) {
            var xhr = new XMLHttpRequest();
        } else { //IE6及其以下版本浏览器
            var xhr = new ActiveXObject('Microsoft.XMLHTTP');
        }

        //接收 - 第三步
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                var status = xhr.status;
                if (status >= 200 && status < 300) {
                    options.success && options.success(formateData(xhr.responseText), status, xhr, options);
                } else {
                    options.error && options.error(xhr, status, options);
                }
                options.complete && options.complete(xhr, xhr.responseText, options);
            }
        }

        //连接 和 发送 - 第二步
        if (/^get$/i.test(options.type)) {
            xhr.open("GET", options.url, options.async);
            xhr.send(null);
        } else if (/^post$/i.test(options.type)) {
            xhr.open("POST", options.url, options.async);
            //设置表单提交时的内容类型
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
            xhr.send(null);
        }

        //格式化数据
        function formateData(text, type){
            if(type == 'json' && /^\s*[\[\{].*[\}\]]\s*$/.test(text)){
                try{
                    text = (new Function("return " + text))();
                }catch(e){
                    text = {data : text};
                }
            }
            return text;
        }
    }

    //获取模板
    function getTpl(id, text){
        var html = false;
        if(text != undefined){
            if(defaults['cache']) $cache[id] = text;
            return text;
        }

        if(defaults['cache']){
            html = $cache[id];
            if(html == undefined){
                html = false;
                var el = $el(id);
                if(el){
                    html = el.innerHTML;
                    $cache[id] = html;
                }
            }
        }else{
            var el = $el(id);
            if(el){
                html = el.innerHTML;
            }
        }

        return html;
    }

    //获取元素
    function $el(id){
        var el = null;
        if(isString(id)){
            el = document.getElementById(id);
        }
        return el;
    }

    //检测v的类型
    function _type(v){
        return Object.prototype.toString.call(v);
    }

    //是否为纯对象类型
    function isPlainObject(v){
        return !!v && _type(v) === '[object Object]';
    }

    //是否为纯对象类型
    function isArray(v){
        return !!v && _type(v) === '[object Array]';
    }

    //是否为字符串
    function isString(v){
        return _type(v) === '[object String]';
    }

    function isEmpty(v, allowBlank){
        return v === null || v === undefined ||
            (isArray(v) && !v.length) ||
            (!allowBlank ? v === '' : false);
    }

    /**
     * 是否为DOM元素
     */
    function isDOM(v){
        var func = ( typeof HTMLElement === 'object' ) ?
            function(obj){
                return obj instanceof HTMLElement;
            } :
            function(obj){
                return obj && typeof obj === 'object' && obj.nodeType === 1 && typeof obj.nodeName === 'string';
            }

        return func(v);
    }

    // 获取变量
    function getVariable (code) {
        return code
            .replace(REMOVE_RE, '')
            .replace(SPLIT_RE, ',')
            .replace(KEYWORDS_RE, '')
            .replace(NUMBER_RE, '')
            .replace(BOUNDARY_RE, '')
            .split(SPLIT2_RE);
    };

    // 静态分析模板变量
    var KEYWORDS =
        // 关键字
        'break,case,catch,continue,debugger,default,delete,do,else,false'
        + ',finally,for,function,if,in,instanceof,new,null,return,switch,this'
        + ',throw,true,try,typeof,var,void,while,with'

        // 保留字
        + ',abstract,boolean,byte,char,class,const,double,enum,export,extends'
        + ',final,float,goto,implements,import,int,interface,long,native'
        + ',package,private,protected,public,short,static,super,synchronized'
        + ',throws,transient,volatile'

        // ECMA 5 - use strict
        + ',arguments,let,yield'

        + ',undefined';

    var REMOVE_RE = /\/\*[\w\W]*?\*\/|\/\/[^\n]*\n|\/\/[^\n]*$|"(?:[^"\\]|\\[\w\W])*"|'(?:[^'\\]|\\[\w\W])*'|\s*\.\s*[$\w\.]+/g;
    var SPLIT_RE = /[^\w$]+/g;
    var KEYWORDS_RE = new RegExp(["\\b" + KEYWORDS.replace(/,/g, '\\b|\\b') + "\\b"].join('|'), 'g');
    var NUMBER_RE = /^\d[^,]*|,\d[^,]*/g;
    var BOUNDARY_RE = /^,+|,+$/g;
    var SPLIT2_RE = /^$|,+/;

    return template;
}));