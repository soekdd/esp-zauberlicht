const express = require('express')
const jsonFile = require('jsonfile')
const dgram = require('dgram')
const fs = require('fs')
const { group } = require('console')
const app = express()
app.use(express.urlencoded({
	extended: true
  }))
const port = 8088
const Template = require("./template").Template
const t = new Template()
const jsonFileName = 'data/progs.json' 
var progs = {};
var emptyESP = {"84F3EB63C229":{name:"Lucia"},"CC50E35984A7'":{name:"Anna"},"7":{name:"Otis"},"DC4F22167DD4":{name:"Sören"},"B":{name:"Vince"}};

var executeCode = (key)=>{
	let evalString = `
		progs['`+key+`'].code = new (class extends Template {
		 `+progs[key].prog.replace(/function\s/gi,'')+`
		})('`+key+`','`+progs[key].ip+`')
	`
	try{
		//console.log(evalString)
		eval(evalString)
	} catch(e) {
		console.log(e.stack.split('\n'));		
		let d;
		if (e.stack) { 
			let s = e.stack.split('\n');
			let t = s[1].split('<anonymous>');
			t = t.length>1?t[1]:t[0];
			d = {
				message:s[0],
				lineNumber:parseInt(t.split(':')[1])-2
			}
		} else {
			d.message = e.message;
		}
		return d
	}		
	return null
}

var proceedProgsFirst = (obj)=>{
	progs = obj;
	Object.keys(progs).forEach(key=>{
		if (!progs[key]) progs[key] = {}
		if (!progs[key].prog) progs[key].prog = ''
		if (!progs[key].color) progs[key].color = ['#FFFFFF','#FFFFFF','#FFFFFF']
		executeCode(key)
	})
	saveProgs() 
}

var getFilteredProgs = ()=>{
	let data = {}
	Object.keys(progs).forEach(key=>{
		data[key] = {prog:progs[key].prog,
					//num:progs[key].num,
					ip:progs[key].ip,
					name:progs[key].name,
					color:progs[key].color}
	})
	return data;
}

var saveProgs=()=>{
	console.log('write file')
	jsonFile.writeFile(jsonFileName,getFilteredProgs(),{ spaces: 2, EOL: '\r\n' }, (err)=>{
		if (err) console.error(err)
	})
}

var loadProgs=()=>{
	fs.exists(jsonFileName, function(exists) {
		if (exists) {
			console.log('read prog file')
	    	jsonFile.readFile(jsonFileName)
				.then(obj => {
					proceedProgsFirst(obj)
		})
  				.catch(error => console.error(error))
		} else {
			console.log('create new prog file')
    		proceedProgsFirst(emptyESP);
  		}
	})
}

app.use('/',express.static('public'))
app.use('/lib/',express.static('node_modules'))

app.get('/register*', (req, res) => {
	try{		
		let dataSet = JSON.parse(decodeURIComponent(req._parsedUrl.query.toUpperCase()))
		let key = dataSet.MAC.replace(/:/g,'')
		console.log(dataSet,'registered')
		if (!progs[key]) 
			res.end()
		else {
			progs[key].ip = dataSet.IP;
			if (progs[key].code)
				progs[key].code._clearTimer()
			let e = executeCode(key);
			if (progs[key].code._register)
				res.end(progs[key].code._register(dataSet))
			else res.end()
		}
	} catch (e){
		console.log(e)
	}
})

const getAllClassMethods = (obj) => {
	let keys = []
	do {
	  const l = Object.getOwnPropertyNames(obj)
	  keys = keys.concat(l)
	  // walk-up the prototype chain
	  obj = Object.getPrototypeOf(obj)
	} while (
	  // not the the Object prototype methods (hasOwnProperty, etc...)
	  obj && Object.getPrototypeOf(obj)
	)  
	return keys
  }

app.get('/data', (req, res) => {
	res.header("Content-Type", "application/json; charset=utf-8")
	methodes = {}
	let key = req._parsedUrl.query
	getAllClassMethods(t).forEach(mkey=>{
		if (mkey[0]!='_' && mkey!='constructor') {
			let params = {}
			let descr = ''
			let group = ''			
			let source = t[mkey].toString().split("\n")
			let call = 'this.'+source[0].replace(/\)(.*)/gm,')')
			source.forEach(s=>s.trim())
			paramsKeys = /\((.*)\)/gm.exec(call)[1].split(',')			
			source.forEach(s=>{
				let parts = /(\/\/)\s*(\S+)\s*\:\s*(\S*.*\S)/gm.exec(s)
				if (parts && parts.length > 0 && parts[1] == '//') {
					if (parts[2] == '_group') group = parts[3]
					if (parts[2] == '_descr') descr = parts[3]
					if (parts[2] == '_call') call = parts[3]
					if (paramsKeys.indexOf(parts[2])!=-1) {
						params[parts[2]] = parts[3]
					}
				}
			})
			methodes[mkey] = {name:mkey,call:call,group:group,descr:descr,params:params,type:typeof t[mkey]}
		}
	})
	let out = {
		progs:getFilteredProgs(),
		methods:methodes,
		groupNames:groupNames
	}
	res.end(JSON.stringify(out))
})

app.post('/post', (req, res) => {
	if (req.body) { 
		key = req.body.key;		
		if (progs[key]) {
			progs[key].prog = req.body.prog;			
			if (progs[key].code)
				progs[key].code._clearTimer()
			let e = executeCode(key);
			if (e == null) {
				saveProgs();
				res.end('OK '+key+' '+progs[key].prog);
				progs[key].code._register()
			} else res.json({message:e.message,
							lineNumber:e.lineNumber});
		}
	} else {
		res.end('empty post');
	}
})

app.get('/live/', (req, res) => {
	let active = []
	Object.keys(progs).forEach(key=>{
		if (progs[key]._active)
		active.push(key)
	})
	res.end(JSON.stringify(active));
})

app.get('/esp*', (req, res) => {
	let key = ''+req._parsedUrl.query.toUpperCase()
	if (!progs[key]) 
		res.end()
	else {
		res.end(ledToString(key))
	}
})

app.listen(port, () => {
  console.log(`ESP Zauberlicht app listening at http://localhost:${port}`)
})

loadProgs();