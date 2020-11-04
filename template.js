const { createCanvas, loadImage } = require('canvas');
const Plasma = require('./plasma').Plasma;
const Fire = require('./fire').Fire;
var dgram = require('dgram')
const axios = require('axios')
global.sofort = 0
global.sehrschnell = 500 / 24
global.schnell = 1000 / 24
global.langsam = 4000 / 24
global.sehrlangsam = 10000 / 24
global.rot = { r: 255, g: 0, b: 0, i: 0 }
global.gruen = { r: 0, g: 165, b: 0, i: 0 }
global.hellgruen = { r: 0, g: 255, b: 0, i: 0 }
global.blau = { r: 0, g: 0, b: 255, i: 0 }
global.magenta = { r: 255, g: 0, b: 255, i: 0 }
global.gelb = { r: 255, g: 255, b: 0, i: 0 }
global.violett = { r: 128, g: 0, b: 128, i: 0 }
global.tuerkis = { r: 0, g: 255, b: 255, i: 0 }
global.weiss = { r: 255, g: 255, b: 255, i: 0 }
global.schwarz = { r: 0, g: 0, b: 0, i: 0 }
global.orange = { r: 255, g: 165, b: 0, i: 0 }
global.braun = { r: 139, g: 69, b: 19, i: 0 }
global.grau = { r: 128, g: 128, b: 128, i: 0 }
global.hellgrau = { r: 165, g: 165, b: 165, i: 0 }
global.dunkelgrau = { r: 80, g: 80, b: 80, i: 0 }
global.wheatherTemps = {};
global.wheatherConds = {};
global.matrix1616 = 16;
global.matrix832 = 8;
global.ring24 = 24;
global.ring3 = 3;
global.filterInvert = 1001;
global.filterWhite = 1002;
global.sunrise
global.sunset
global.groupNames = [
    { key: "basis", name: "Grundbefehle" },
    { key: "led", name: "LED Befehle" },
    { key: "canvas", name: "Bildbefehle" },
    { key: "date", name: "Datum Uhrzeit" },
    { key: "wheather", name: "Wetter" },
    { key: "event", name: "Ereignisse" },
    { key: "profi", name: "Kompliziertes" }
];

global.spriteControl =
{
    width:16,
    height:16,
    offx:0,
    offy:0,
    actions:{
        'vorn':[0,6],
        'hinten':[3,6],
        'links':[1,6],
        'rechts':[2,6]
    }
}

const onePlasma = new Plasma();
const oneFire = new Fire();

let getWheather = () => {
    axios.get('http://api.openweathermap.org/data/2.5/forecast?id=2935022&mode=json&appid=e0cf30e234e416e8dc0bcc0c34d75785&lang=de').then(response => {
        let nll = val => {
            return val < 10 ? '0' + val : val
        }
        wheatherTemps = {}
        wheatherConds = {}
        let nowH = Math.floor((new Date()).getHours() / 3 + 1) * 3
        for (var i = 0; i < 2; i++) {
            let key = ['today', 'tomorrow'][i]
            wheatherTemps[key] = {}
            wheatherConds[key] = {}
            let timesP = { morning: 6, noon: 12, eventing: 18 }
            if ((key == 'today') && (nowH < 24))
                timesP['now'] = nowH
            if ((key == 'tomorrow') && (nowH == 24))
                timesP['now'] = 0
            Object.keys(timesP).forEach(function (timesK) {
                let times = timesP[timesK]
                var nextDay = Date.now() + (i * 24 * 60 * 60 * 1000)
                var compareDate = (new Date(nextDay)).getFullYear() + '-' + nll((new Date(nextDay)).getMonth() + 1) + '-' + nll((new Date(nextDay)).getDate()) + ' ' + nll(times) + ':00:00'
                response.data.list.forEach(function (weatherPart) {
                    if (weatherPart.dt_txt == compareDate) {
                        if (timesK == 'now') {
                            wheatherTemps['now'] = Math.round(weatherPart.main.temp - 273.15)
                            wheatherConds['now'] = weatherPart.weather[0].main
                        } else {
                            wheatherTemps[key][timesK] = Math.round(weatherPart.main.temp - 273.15)
                            wheatherConds[key][timesK] = weatherPart.weather[0].main
                        }
                    }
                });
            });
        }
        sunrise = new Date(response.data.city.sunrise * 1000);
        sunset = new Date(response.data.city.sunset * 1000);
    })
}

getWheather();
setInterval(getWheather, 3600 * 1000);

class Template {
    _mode = ring24;
    _key = '0';
    _aniCounter = 0;
    _leds = [];
    _num = 24;
    _brightness = 7;
    _active = false;
    _udpPort = 81;
    _leaseTime = 4000;
    _ip = null;
    _lastRegister = 0;
    _intervals = [];
    _timeouts = [];
    _timers = [];
    _icons = {};
    _sprites = {};
    constructor(key, ip) {
        if (!key) return
        this._canvas = createCanvas(64, 64)
        this._ctx = this._canvas.getContext('2d');
        this._ctx.imageSmoothingEnabled = false;
        this._register({ IP: ip, MAC: null, FW: null });
        this._key = key;
        this._setNum(this._num);
        this.start();
        this.jedeSekunde();
        this.jedeZehntel();
        this.jedeHundertstel();
        this._timers.push(setInterval((() => {
            try {
                this.jedeSekunde();
            } catch (e) { }
        }).bind(this), 1000));
        this._timers.push(setInterval((() => {
            try {
                this.jedeHundertstel()
            } catch (e) { }
        }).bind(this), 10));
        this._timers.push(setInterval((() => {
            try {
                this.jedeZehntel();
            } catch (e) { }
        }).bind(this), 100));
        console.log('Instanz: ' + key + ', IP: ' + ip + ' created!');
    }
    _isactive() {
        this._active = (this._lastRegister + this._leaseTime * 1000) > new Date().getTime()
        return this._active
    }
    _setNum(num) {
        this._num = num
        this._leds = Array(this._num).fill({ r: 0, g: 0, b: 0, i: 0 })
    }
    _register(dataSet) {
        this._lastRegister = new Date().getTime()
        if (dataSet) {
            this._ip = dataSet.IP;
            this._mac = dataSet.MAC;
            this._firmware = dataSet.FW;
        }
        return JSON.stringify({ "num_led": this._num, "brightness": this._brightness, "activeLED": 1 }) //this._active?1:0
    }
    _ledAsBinary() {
        let b = Buffer.alloc(this._num * 3 + 1)
        b[0] = 76
        let c = 0
        this._leds.forEach(led => {
            b[c * 3 + 1] = led.r
            b[c * 3 + 2] = led.g
            b[c * 3 + 3] = led.b
            c++
        })
        return b;
    }
    _test() {
        this._leds = Array(this._num).fill({ r: 255, g: 255, b: 0, i: 0 })
        for (let i = -5; i < 5; i++) {
            this._leds[(this._count + i) % this._num] = { r: 255 - Math.abs(i) * 48, g: 15 + Math.abs(i) * 48, b: 0, i: 0 }
            this._leds[(this._count + i + this._num / 2) % this._num] = { r: 255 - Math.abs(i) * 48, g: 0, b: 15 + Math.abs(i) * 48, i: 0 }
        };
        this._count++
        this.fertig()
    }
    _clearTimer() {
        this._timers.forEach(i => { clearInterval(i) })
        this._timers = []
        this.stop();
    }

    _getFilterParam(pix,filter,width,height){
        let f={fr:1,fb:1,fg:1,minr:0,maxr:255,minb:0,maxb:255,ming:0,maxg:255};
        if (filter == global.filterWhite) {
            f={fr:1,fb:1,fg:1,minr:255,maxr:0,minb:255,maxb:0,ming:255,maxg:0};
            for (let y = 0; y < width; y++)
                for (let x = 0; x < height; x++) {
                    let c = 4 * ((4 * y + 2) * 64 + (4 * x + 2))
                    let p = { r: pix[c], g: pix[c + 1], b: pix[c + 2], i: 0, a: pix[c + 3] }
                    if (p.r<f.minr) f.minr = p.r;
                    if (p.r>f.maxr) f.maxr = p.r;
                    if (p.g<f.ming) f.ming = p.g;
                    if (p.g>f.maxg) f.maxg = p.g;
                    if (p.b<f.minb) f.minb = p.b;
                    if (p.b>f.maxb) f.maxb = p.b;
                }            
            f.fr = 255/(f.maxr-f.minr);
            f.fg = 255/(f.maxg-f.ming);
            f.fb = 255/(f.maxb-f.minb);
        } else if (filter == global.filterInvert) {
            f={fr:-1,fb:-1,fg:-1,minr:255,maxr:0,minb:255,maxb:0,ming:255,maxg:0};            
        }
        return f;
    }

    bildZuLEDs(filter) {
        // _group : canvas
        //_descr: Ueberträgt den Bildspeicher in den LED Speicher
        let pix = Array(64 * 64 * 4).fill(127);
        try {
            pix = this._ctx.getImageData(0, 0, 64, 64).data;
        } catch (e) {
            console.log(e);
            return;
        }            
        let f =  this._getFilterParam(pix,filter,64,64);        
        if (this._mode == matrix1616) {            
            for (let y = 0; y < 16; y++)
                for (let x = 0; x < 16; x++) {
                    let j = 4 * ((4 * y + 2) * 64 + (4 * x + 2))
                    this.matrixQXY(x, y, { r: Math.floor(f.fr*(pix[j]-f.minr)), 
                                           g: Math.floor(f.fg*(pix[j + 1]-f.ming)), 
                                           b: Math.floor(f.fb*(pix[j + 2]-f.minb)), i: 0 })
                }            
        } else if (this._mode == matrix832) {
            for (let y = 0; y < 8; y++)
                for (let x = 0; x < 32; x++) {
                    let j = 4 * ((2 * y + 1) * 64 + (2 * x + 1))
                    this.matrixQXY(x, y, { r: Math.floor(f.fr*(pix[j]-f.minr)), 
                                           g: Math.floor(f.fg*(pix[j + 1]-f.ming)), 
                                           b: Math.floor(f.fb*(pix[j + 2]-f.minb)), i: 0/*, a: pix[c + 3]*/ })
                }
        } if (this._mode == ring3) {
            let c = 0;
            [{ r: 30, max: 60 }, { r: 24, max: 48 }, { r: 20, max: 40 }].forEach(s => {
                for (let i = 0; i < s.max; i++) {
                    let x = Math.round(32 + s.r * Math.sin(Math.PI * 2 * i / s.max))
                    let y = Math.round(32 - s.r * Math.cos(Math.PI * 2 * i / s.max))
                    let j = 4 * (y * 64 + x)
                    this._leds[c] = { r: Math.floor(f.fr*(pix[j]-f.minr)), 
                                      g: Math.floor(f.fg*(pix[j + 1]-f.ming)), 
                                      b: Math.floor(f.fb*(pix[j + 2]-f.minb)), i: 0/*, a: pix[c + 3]*/ }
                    c++
                }
            })
        }
    }

    malePlasma() {        
        // _group : canvas
        //_descr: zeichnet ein Plasma auf das Bild
        onePlasma.plasmaUpdate(this._ctx);
    }

    maleFeuer() {        
        // _group : canvas
        //_descr: zeichnet ein Feuer auf das Bild
        oneFire.updateFire(this._ctx);        
    }

    ladeAnimation(spritename,controller) {
        // spritename: Name der Sprite Datei
        // controller: Beschreibung des Sprites 
        // _group : canvas
        //_descr: laedt ein Sprite
        loadImage('sprites/'+spritename+'.png').then(((image) => {
            this._sprites[spritename] = {"image": image,"controller":controller};
        }).bind(this));
    }

    zeigeAnimation(spritename,bewegung) {
        // spritename: Platznummer in der die Animation abgelegt wurde 
        // _group : canvas
        //_descr: zeigt Bild an  
        let s = this._sprites[spritename];
        console.log(s);
        if (!s.controller.offx) s.controller.offx = 0;
        if (!s.controller.offy) s.controller.offy = 0;
        if (this._aniCounter>=spriteControl.actions[bewegung][1]) {
            this._aniCounter = 0;
        }
        let x = this._aniCounter;
        let y = s.controller.actions[bewegung][0];
        this._ctx.drawImage(s.image
            ,x*s.controller.width,y*s.controller.height
            ,s.controller.width,s.controller.height,s.controller.offx,s.controller.offy,64,64);
        this._aniCounter++;
    }


    ladeBild(bildname) {
        // bildname: Name der Bild Datei
        // _group : canvas
        //_descr: laedt ein Bild und speichert sie in einer Variable 
        loadImage('icons/'+bildname+'.png').then(((image) => {
            this._icons[bildname] = image;
        }).bind(this));
    }

    zeigeBild(bildname) {
        // bildname: Name der Bild Datei
        // _group : canvas
        //_descr: zeigt Bild an 
        this._ctx.drawImage(this._icons[bildname],0,0,64,64);
    }

    ledModus(mode) {
        //mode: matrix1616, matrix832, ring24, ring3
        // _group : led
        //_descr: Bestimmt, welches Licht angeschlossen ist
        this._mode = mode;
        if (mode == matrix1616 || mode == matrix832)
            this._ledNum(256)
        else if (mode == ring24)
            this._ledNum(26)
        else if (mode == ring3)
            this._ledNum(148)
    }

    _ledNum(anzahl) {
        //anzahl: 16 kleiner Ring, 148 großer Ring, 256 Matrix
        // _group : led
        //_descr: Ändert die Anzahl an LEDs
        let b = Buffer.alloc(5)
        b[0] = 78
        this._setNum(parseInt(anzahl))
        b[1] = this._num & 255
        b[2] = Math.floor(this._num / 256)
        let client = dgram.createSocket('udp4')
        client.send(b, 0, 5, 81, this._ip, function (err, bytes) {
            client.close()
        })
    }
    helligkeit(helligkeitswert) {
        //helligkeitswert: 1 dunkel, 255 sehr hell
        // _group : led
        //_descr: Steuert die Helligkeit des Zauberlichts    
        let b = Buffer.alloc(5)
        b[0] = 66
        this._brightness = parseInt(helligkeitswert) % 256
        b[1] = this._brightness
        let client = dgram.createSocket('udp4')
        client.send(b, 0, 5, 81, this._ip, function (err, bytes) {
            client.close()
        })
    }
    fertig() {
        //_group: basis
        //_descr: Schickt die LED Befehle an das Zauberlicht    
        if (!this._isactive()) return
        //console.log(this._ip, this._num)
        let client = dgram.createSocket('udp4')
        client.send(this._ledAsBinary(), 0, this._num * 3 + 1, 81, this._ip, function (err, bytes) {
            client.close()
        })
    }
    _rotate(count) {
        let temp = [...this._leds]
        for (let i = 0; i < this._num; i++) {
            this._leds[i] = temp[(this._num + i + count) % this._num]
        }
    }
    spiegelH() {
        //_group: led
        //_descr: Spiegelt die Anzeige horizontal
        let temp = [...this._leds]
        for (let i = 1; i < Math.round(this._num) / 2 + 1; i++) {
            this._leds[i] = temp[(this._num) / 2 - i]
            this._leds[(this._num - i) % this._num] = temp[(this._num) / 2 + i]
        }
        this._leds[0] = temp[Math.round(this._num / 2)]
        this._leds[Math.round(this._num / 2)] = temp[0]
    }
    spiegelV() {
        //_group: led
        //_descr: Spiegelt die Anzeige vertikal
        let temp = [...this._leds]
        for (let i = 0; i < this._num; i++) {
            this._leds[i] = temp[this._num - i - 1]
        }
    }
    drehe(anzahl, tempo) {
        //anzahl: Anzahl der Schritte gedreht werden soll. >0 Uhrzeigersinn <0 gegen Uhrzeigersinn
        //tempo:  [sofort,sehrschnell,schnell,langsam,sehrlangsam]
        //_group: led
        //_descr: Dreht die Anzeige.
        if (tempo == null || tempo == 0)
            this._rotate(anzahl)
        else {
            for (let t = 0; t < Math.abs(anzahl); t++) {
                this._timeouts.push(setTimeout((() => {
                    this._rotate(Math.sign(anzahl))
                    this.fertig()
                }).bind(this), t * tempo));
            }
        }
    }
    zufallsfarbe()
    //_group: led
    //_descr: Gibt eine zufällige Farbe zurück    
    {
        return { r: Math.floor(Math.random() * 256), g: Math.floor(Math.random() * 256), b: Math.floor(Math.random() * 256), i: 0 }
    }
    matrixQXY(x, y, farbe)
    //x: X Position 0..31
    //y: Y Position 0..15
    //farbe: Farbe die gesetzt werden soll
    //_group: led
    //_descr: Setz Farbe in Matrix
    {
        let i;
        if ((y % 2) == 1) {
            i = y * 16 + x
        } else {
            i = y * 16 + (15 - x)
        }
        if (farbe.a != undefined) {
            let o = this._leds[i]
            let a = farbe.a / 256
            this._leds[i] = {
                r: Math.round((1 - a) * o.r + a * farbe.r),
                g: Math.round((1 - a) * o.g + a * farbe.g),
                b: Math.round((1 - a) * o.b + a * farbe.b),
                i: 0
            }
            //this._leds[i]= farbe 
            //console.log(farbe,o,this._leds[i])
        } else this._leds[i] = farbe
    }
    setzePixel(index, farbe)
    //index: 0..23 Position des Pixels der gesetzt werden soll
    //farbe: Farbe die gesetzt werden soll
    //_group: led
    //_descr: Setzt die Farbe einer einzelnen LED. this.fertig() nicht vergessen!      
    {
        this._leds[index % this._num] = farbe;
    }
    invertierePixel(index)
    //index: 0..23 Position des Pixels der gesetzt werden soll
    //_group: led
    //_descr: Invertierte die Farbe einer LED. this.fertig() nicht vergessen!      
    {
        ['r','g','b'].forEach(c=>this._leds[index % this._num][c] = 255-this._leds[index % this._num][c]);
    }

    fuelleBild(farbe) {
        //farbe: Farbe mit der gefüllt werden soll
        //_group: canvas
        //_descr: Füllt das Bild mit einer Farbe.
        this._ctx.fillStyle = `rgb(${farbe.r},${farbe.g},${farbe.b})`;
        this._ctx.fillRect(0, 0, 64, 64);      
    }

    fuelle(farbe) {
        //farbe: Farbe mit der gefüllt werden soll
        //_group: led
        //_descr: Füllt den Ring mit einer Farbe. this.fertig() nicht vergessen!      
        for (let i = 0; i <= this._num; i++) {
            this._leds[i] = farbe
        }
    }
    wochentag() {
        //_group: date
        //_descr: Gibt den aktuellen Wochentag 1..7 zurück
        let date = new Date
        let d = date.getDay()
        return d == 0 ? 7 : d
    }
    tag() {
        //_group: date
        //_descr: Gibt den aktuellen Tag des Monats zurück 1..31
        let date = new Date
        return date.getDate()
    }
    wetterJetzt() {
        //_group: wheather
        //_descr: Gibt das akutelle Wetter zurück [Clouds, Clear, Snow, Rain, Drizzle, Thunderstorm]
        return wheatherConds.now
    }
    tempJetzt() {
        //_group: wheather
        //_descr: Gibt die akutelle Temperatur zurück
        return wheatherTemps.now
    }
    wetterHeute() {
        //_group: wheather
        //_descr: Gibt das heutige Wetter [Clouds,Clear,Snow,Rain,Drizzle,Thunderstorm] als Liste mit 3 Werten [früh,mittags,abends] zurück
        return wheatherConds.today
    }
    tempHeute() {
        //_group: wheather
        //_descr: Gibt eine Liste mit 3 Temperaturwerten [früh,mittags,abends] für den heutigen Tag zurück
        return wheatherTemps.today
    }
    wetterMorgen() {
        //_group: wheather
        //_descr: Gibt das morgige Wetter [Clouds,Clear,Snow,Rain,Drizzle,Thunderstorm] als Liste mit 3 Werten [früh,mittags,abends] zurück
        return wheatherConds.tomorrow
    }
    tempMorgen() {
        //_group: wheather
        //_descr: Gibt eine Liste mit 3 Temperaturwerten [früh,mittags,abends] für den morgigen zurück
        return wheatherTemps.tomorrow
    }
    sonnenaufgang() {
        //_group: wheather
        //_descr: Gibt den Sonnenaufgangszeitpunnkt in Stunden zurück. Beispiel: 5.2342 
        return sunrise.getHours() + sunrise.getMinutes() / 60
    }
    sonnenuntergang() {
        //_group: wheather
        //_descr: Gibt den Sonnenuntergangszeitpunnkt in Stunden zurück. Beispiel: 19.2342 
        return sunset.getHours() + sunset.getMinutes() / 60
    }
    monat() {
        //_group: date
        //_descr: Gibt den aktuellen Monat zurück 1..12
        return new Date().getMonth() + 1
    }
    jahr() {
        //_group: date
        //_descr: Gibt das aktuelle Jahr zurück 2020...
        return new Date().getFullYear()
    }
    stunde() {
        //_group: date
        //_descr: Gibt die aktuelle Stunde zurück 0..23
        return new Date().getHours()
    }
    ledStunde() {
        //_group: date
        //_descr: Gibt die aktuelle Stunde in der passenden LED Position 0..23 zurück
        return Math.round(((this.stunde() + this.minute() / 60) % 12) * this._num / 12)
    }
    minute() {
        //_group: date
        //_descr: Gibt die aktuelle Minute zurück 0..59
        return new Date().getMinutes()
    }
    ledMinute() {
        //_group: date
        //_descr: Gibt die aktuelle Minute in der passenden LED Position 0..23 zurück
        return Math.round(((this.minute() + this.sekunde() / 60) % 60) * this._num / 60)
    }
    sekunde() {
        //_group: date
        //_descr: Gibt die aktuelle Sekunde zurück 0..59
        return new Date().getSeconds()
    }
    ledSekunde() {
        //_group: date
        //_descr: Gibt die aktuelle Sekunde in der passenden LED Position 0..23 zurück
        return Math.round((this.sekunde() % 60) * this._num / 60);
    }
    laufEinmal(von, bis, farbe, tempo) {
        //von: Startposition 0..23
        //bis: Endposition 0..23
        //farbe: Farbe die gesetzt werden soll
        //tempo: [sehrschnell,schnell,langsam,sehrlangsam]
        //_group: led
        //_descr: Lässt ein Licht einmal durchlaufen (kein this.fertig() erforderlich)
        let t = 0;
        let buffer = [];
        if (von >= bis)
            bis = bis + this._num;
        for (let i = von; i <= bis; i++) {
            this._timeouts.push(setTimeout((() => {
                buffer[i % this._num] = this._leds[i % this._num]
                this._leds[i % this._num] = farbe
                this.fertig()
            }).bind(this), t * tempo));
            this._timeouts.push(setTimeout((() => {
                this._leds[i % this._num] = buffer[i % this._num]
                this.fertig()
            }).bind(this), (t + 1) * tempo));
            t++;
        }
    }
    stop() {
        //_group: event
        //_descr: Beendet alle akutell laufenden Timer
        console.log(this._intervals.length)
        this._intervals.forEach(i => { clearInterval(i) })
        this._intervals = []
        console.log(this._timeouts.length)
        this._timeouts.forEach(t => { clearTimeout(t) })
        this._timeouts = []
    }
    startTest() {
        //_group: led
        //_descr: startet einen lustigen Regenbogen als Test
        this._count = 0
        this._intervals.push(setInterval((this._test).bind(this), 50))
    }
    jedeSekunde() {
        //_group: event
        //_descr: Inhalt der Funktion wird einmal pro Sekunde aufgerufen 
        //_call: jedeSekunde(){\n}
    }
    jedeZehntel() {
        //_group: event
        //_descr: Inhalt der Funktion wird 10 mal pro Sekunde aufgerufen 
        //_call: jedeZehntel(){\n}
    }
    jedeHundertstel() {
        //_group: event
        //_descr: Inhalt der Funktion wird 100 mal pro Sekunde aufgerufen 
        //_call: jedeHundertstel(){\n}
    }
    start() {
        //_group: basis
        //_descr: Inhalt der Funktion wird einmal am Anfang aufgerufen 
        //_call: start(){\n}
    }
    eigenerTimer(func, millisekunden) {
        //func: Funktion die aufgerufen werden soll
        //millisekunden: Zeit zwischen zwei Aufrufen
        //_group: profi
        //_descr: Startet eigenen Timer, ersetzt setInterval 
        if (millisekunden < 10) return;
        this._timers.push(setInterval((() => {
            try {
                func
            } catch (e) { }
        }).bind(this), millisekunden))
    }
}
exports.Template = Template;