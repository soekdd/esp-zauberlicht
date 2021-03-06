/*   Ported from https://github.com/zufallsgenerator/firesimulation.git
 *   Special thanks to Christer @ Zufallsgenerator
 */
'use strict'
const { createCanvas } = require('canvas');
function blendingfunc(t) {
  if (t > 0.8) {
    t = t * 1.05;
  } else if (t < 0.2 && t > 0.1) {
    t = t * 0.98;
  }
  return t;// (3 * t * t) - (2 * t * t * t);
}

class Fire {
  xvariation = 50;
  xinfluence = 51;
  yvariation = 53;
  yinfluence = 100;
  cellpersistency = 85;
  ascent = 91;
  normalizer = 270;
  colorfactor = 175;
  minfuel = 0;
  maxfuel = 238;
  x = 0;
  y = 0;
  zindex = 1;
  width = 64;
  height = 64;
  blocksize = 1;
  c1 = "#ffffff";
  c2 = "#E9F23F";
  c3 = "#D6661C";
  c4 = "#440000";
  c5 = "#111111";
  l1 = 84;
  l2 = 64;
  l3 = 35;
  l4 = 17;
  l5 = 14;

  constructor() {
    var tmpCanvas = createCanvas(this.width,this.height);
    this.tmpCtx = tmpCanvas.getContext("2d");
    this._initValues();
  }

  _initValues() {
    this.grid = [];
    this.flipGrid = [];
    this.savedGrids = [];
  }

  _paint(ctx) {
    var x, y, line, point, color, b = this.blocksize, g = this.grid, imageData;
    if (this.savedGrids.length >= this.saveLen) {
      this.idx = ((this.idx || 0) + 1) % this.savedGrids.length;
      g = this.savedGrids[this.idx];
    }

    imageData = this.tmpCtx.createImageData(this.width, this.height);//ctx.getImageData(this.x, this.y, this.width, this.height);
    var d = imageData.data;
    for (y = 0; y < g.length; y++) {
      line = g[y];
      for (x = 0; x < line.length; x++) {
        point = line[x];
        color = this._getColorArray(point);
        var idx = ((this.height - y) * this.width * 4) + (x * 4);
        if (!color) {
          color = [0, 0, 0, 0];
        }
        d[idx + 0] = color[0];
        d[idx + 1] = color[1];
        d[idx + 2] = color[2];
        d[idx + 3] = color[3];
      }
    }
    this.tmpCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(this.tmpCtx.canvas, this.x, this.y, this.width * b, this.height * b);
  }

  _getColorArray(intensity) {
    var n = Math.min(Math.round(intensity * this.colorfactor), 255);
    if (this.maxIntensity === undefined) {
      this.maxIntensity = intensity;
      this.minIntensity = intensity;
    } else {
      this.maxIntensity = Math.max(this.maxIntensity, intensity);
      this.minIntensity = Math.min(this.minIntensity, intensity);
    }
    if (!this.colorArray) {
      this.colorArray = [];
      for (n = 0; n < 256; n++) {
        this.colorArray.push(this._makeColor(n));
      }
    }
    return this.colorArray[n];
  }

  _makeColor(n) {
    return [255, Math.min(n * 1.2, 255), Math.min(255, Math.max(n - 175, 1) * 4), n];
  }

  _tick(diff) {
    var x, y, target, lower, middle, upper, normalizer = this.normalizer / 200,
      minfuel = this.minfuel / 100, maxfuel = this.maxfuel / 100, TICK_MS = 20,
      xvariation = this.xvariation / 100,
      yvariation = this.yvariation / 100,
      cellpersistency = this.cellpersistency / 100,
      ascent = this.ascent / 100,
      xinfluence = this.xinfluence / 100,
      yinfluence = this.yinfluence / 100;

    if (this.savedGrids.length >= this.saveLen) {
      return;
    }

    if (this.grid.length < this.height) {
      this.grid = this._createGrid(this.height);
      this.flipGrid = this._createGrid(this.height);
    }

    this.ms = (this.ms || 0) + diff;

    let processLine = (target, lower, middle, upper)=>{
      var length = target.length, sum, ybias, centerbias, leftbias, middlebias, rightbias, xbias, topbias, bottombias;
      for (x = 0; x < length; x++) {
        sum = 0;

        ybias = ascent + (yvariation * (Math.random() - (1 - ascent)));
        topbias = (ybias) * yinfluence;
        bottombias = (1 - topbias) * yinfluence;
        middlebias = 0.5;
        xbias = 0.5 + (xvariation * (Math.random() - 0.5));
        leftbias = xbias * xinfluence;
        rightbias = (1 - xbias) * xinfluence;
        centerbias = 0.5;

        if (lower) {
          sum += ((leftbias * (lower[x - 1] || 0)) + ((lower[x] || 0) * centerbias) + (rightbias * (lower[(x + 1)] || 0))) * topbias;
        }
        sum += ((leftbias * (middle[x - 1] || 0)) + (rightbias * (middle[(x + 1)] || 0))) * middlebias;
        if (upper) {
          sum += ((leftbias * (upper[x + 1] || 0)) + ((upper[x] || 0) * centerbias) + (rightbias * (upper[(x - 1)] || 0))) * bottombias;
        }
        sum += middle[x] * cellpersistency;
        target[x] = blendingfunc((1 / 3) * normalizer * sum);
      }
    }
    while (this.ms > TICK_MS) {
      var newLine = [],
        newVal,
        length = this.grid[0].length,
        margin = Math.round(this.grid[0].length * 0.1),
        fuel = maxfuel - minfuel;
      for (x = 0; x < length; x++) {
        if (Math.random() > 0.9 || x === 0) {
          newVal = minfuel + (Math.random() * fuel);
        }
        if (x > margin && x < (length - margin) && newVal > 0.9) {
          newLine.push(newVal);
        } else {
          newLine.push(0);
        }
      }
      for (y = 0; y < this.grid.length; y++) {
        target = this.flipGrid[y];
        lower = this.grid[y - 1];
        middle = this.grid[y];
        upper = this.grid[y + 1];
        processLine(target, lower || newLine, middle, upper);
      }
      this.ms = this.ms - TICK_MS;
    }
    var tmp = this.grid;
    this.gird = this.flipGrid;
    this.flipGrid = tmp;

  }

  _createGrid(height) {
    var grid = [], i;

    function makeLine(length) {
      var line = [], j;
      for (j = 0; j < length; j++) {
        line.push(0);
      }
      return line;
    }
    for (i = 0; i < height; i++) {
      grid.push(makeLine(this.width));
    }
    return grid;
  }
  updateFire(ctx){
    this._tick(10)
    this._paint(ctx);        
  }
}
exports.Fire = Fire;