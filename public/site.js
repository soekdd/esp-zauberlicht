import '/lib/codemirror/lib/codemirror.js';
import '/lib/codemirror/mode/javascript/javascript.js';
import '/lib/codemirror/addon/hint/show-hint.js';
import '/lib/codemirror/addon/hint/javascript-hint.js';
import '/lib/trianglify/dist/trianglify.bundle.js';

var editor = [];
var colors = {};
const prepairEditor = methods=>{
    CodeMirror.hint.myThis = function(cm) {
        var inner = {from: cm.getCursor(), to: cm.getCursor(), list: []};
        methods.forEach(m=>{
            if (m.substring(0,4)=='this')
            inner.list.push(m.replace('this.',''));
        })        
        return inner;
    }
    CodeMirror.commands.autocomplete = editor=> {
        let c = editor.getCursor();
        editor.replaceRange('.', c);
        if (editor.getTokenAt({line: c.line, ch: c.ch>0?c.ch-1:0, sticky: null}).string=='this') {                
            CodeMirror.showHint(editor, CodeMirror.hint.myThis, {});
        } else 
            CodeMirror.showHint(editor, CodeMirror.hint.javascript, {});
    }  
}
const prepairHTML = (progs,groups,groupNames)=>{
    let c = 0;              
    Object.keys(progs).forEach(key=>{
        $('#tabholder').append('<li role="presentation" class="tabs'+(c==0?' active':'')+'"><a id="tab_'+key+'" href="#'+key+'"></a></li>');
        $('#tab_'+key).html(progs[key].name);
        $('#tab_'+key).on('click',()=>changeTab(key));
        $('#content').append(`<div id="content_`+key+`" class="tabContent">
        <div style="height:100%" class="outer row">                  
            <div style="height:100%" class="col-xs-9">
                <div class="inner row">
                    <div class="col-xs-10">
                        <h1>Zauberlicht von `+progs[key].name+`</h1>
                    </div>
                    <div class="link col-xs-w" style="padding:1em;text-align:right">
                        <svg id="saveLogo_`+key+`" width="3em" height="3em" viewBox="0 0 16 16" fill="currentColor">
                            <path fill-rule="evenodd" d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm5.5 10a.5.5 0 0 0 .832.374l4.5-4a.5.5 0 0 0 0-.748l-4.5-4A.5.5 0 0 0 5.5 4v8z"/>
                        </svg>
                    </div>
                </div>
                <div id="code_`+key+`"></div>
                <div class="debug" id="debug_`+key+`"></div>
            </div>
            <div style="height:100%;overflow-y:scroll" class="col-xs-3" id="doc_`+key+`">
            </div>
        </div>`)
        $('#doc_'+key).html('')
        $('#saveLogo_'+key).click(()=>run(key));
        let cm = CodeMirror(document.getElementById("code_"+key), {
            lineNumbers: true,
            value: progs[key].prog,
            mode:  "javascript",
            autofocus: true,
            extraKeys: {
                //"Ctrl-Space": "autocomplete",                    
                "'.'": "autocomplete"
            },
            theme: 'eclipse',
        });
        editor[''+key] = cm; 
        groupNames.forEach(g=>{
            let s = '<h2><svg  class="link down" id="down_'+key+'_'+g.key+'" viewBox="0 0 24 24" width="24" height="24"><path d="M11.646 15.146L5.854 9.354a.5.5 0 01.353-.854h11.586a.5.5 0 01.353.854l-5.793 5.792a.5.5 0 01-.707 0z"></path></svg>'
            s += '<svg style="display:none" class="link up" id="up_'+key+'_'+g.key+'" viewBox="0 0 24 24" width="24" height="24"><path d="M12.354 8.854l5.792 5.792a.5.5 0 01-.353.854H6.207a.5.5 0 01-.353-.854l5.792-5.792a.5.5 0 01.708 0z"></path></svg>'
            s += g.name+'</h2><div style="display:none" class="up" id="methods_'+key+'_'+g.key+'">'
            groups[g.key].forEach(i=>{
                let call = i.call
                let parts = call.split(/\)|\(|,/)
                parts.pop();
                parts.forEach((p,idx)=>{
                    let hint = idx==0?i.descr:(i.params[p]?i.params[p]:'')
                    s += '<a href="#" title="'+hint+'" class="call_'+key+'_'+i.name+'">'+p+'</a>'
                    s += idx==0?'(&nbsp;':(idx>parts.length-2?'&nbsp;)':',&nbsp;')
                })
                s += '<hr>'//+i.descr+'<hr>'
            })
            s += '</div>'
            $('#doc_'+key).append(s)
            $('#down_'+key+'_'+g.key).click(()=>down(key,g.key))
            $('#up_'+key+'_'+g.key).click(()=>up(key,g.key))
            groups[g.key].forEach(i=>{
                $('.call_'+key+'_'+i.name).click(()=>fillCall(key,i.call.replace('\\n',"\n")))
            })
        })
        if (c!=0) $('#content'+c).hide();
        c++;
    })
} 
function fillCall(key,call) {
    var doc = editor[key].getDoc();
    var cursor = doc.getCursor();
    doc.replaceRange(call, cursor);
}
function down(k,g){
    $('.up').hide()
    $('.down').show()
    $('#methods_'+k+'_'+g).show()
    $('#down_'+k+'_'+g).hide()
    $('#up_'+k+'_'+g).show()
}
function up(k,g){
    $('#methods_'+k+'_'+g).hide()
    $('#down_'+k+'_'+g).show()
    $('#up_'+k+'_'+g).hide()
}

function run(key){
    $('#saveLogo_'+key).hide();
    $('#debug_'+key).html('');
    $.ajax({
        type: "POST",
        url: '/post',
        data: {key:key,prog:editor[key].getValue()},
        success: (data)=>{            
            $('#debug_'+key).html(data=='OK'?data:data.message);
            $('#debug_'+key).css('color',data=='OK'?'black':'red')
            $('#saveLogo_'+key).show();
            if (data.lineNumber) {
                editor[''+key].markText({line:data.lineNumber-1,ch:0},{line:data.lineNumber,ch:0},{readOnly:true,clearOnEnter:true,css: "background : red"})                
            }
        }
    });
}

function changeTab(newTab) {
    $(".tabs").each(function () {
        $(this).removeClass("active");
    });
    $(".tabContent").hide();
    $("#tab_" + newTab).addClass("active");
    $("#content_" + newTab).show();
}

function generateBackground(progs) {
    var s = "";
    Object.keys(progs).forEach(function (index) {

        var pattern = trianglify({
            seed: index * 10,
            xColors: colors[index],
            yColors: colors[index],
            variance: 1,
            width: 1980,
            height: 1200
        })
        var data = pattern.toCanvas().toDataURL();        
        $('html > head').append('<style>#tab_' + index + ', #content_' + index + '{background-image: url(' + data + '); }</style>');
    });
}
export function main() {
    $.getJSON( "/data",(data)=>{
        let calls = []
        let groups = {}
        let dummyGroups = {}
        Object.keys(data.methods).forEach(m=>{
            let method = data.methods[m]
            if (!groups[method.group]) {
                groups[method.group] = []
                dummyGroups[method.group] = []
            }
            groups[method.group].push(method)
            dummyGroups[method.group].push(method.call)                     
        })
        Object.keys(dummyGroups).forEach(g=>{
            let group = dummyGroups[g]
            group.sort();
            calls.push(...group)
        })
        Object.keys(data.progs).forEach((key)=>colors[key]=data.progs[key].color)
        console.log(calls)
        prepairEditor(calls)
        prepairHTML(data.progs,groups,data.groupNames)        
        generateBackground(data.progs);
        let parts = window.location.href.split('#');
        if (parts.length>1 && parts[1].length>0) {
            changeTab(parts[1]);
        } else changeTab(Object.keys(data.progs)[0]);
    });
}