/*   Ported from https://towardsdatascience.com/fun-with-html-canvas-lets-make-lava-lamp-plasma-e4b0d89fe778
 *   Special thanks to Slawomir Chodnicki
 */
const { createCanvas } = require('canvas');
class Plasma {
  _heightMap1 = [];
  _heightMap2 = [];
  _palettes = [];
  _palette = [];
  _prevDirection = 1;
  _imgSize = 64;
  _dx1 = 0;
  _dy1 = 0;
  _dx2 = 0;
  _dy2 = 0;  
  _image = null;
  _ctx = null;
  constructor () {
    // init image data with black pixels
    this._ctx = createCanvas(512, 512).getContext("2d");
    this._image = this._ctx.createImageData(this._imgSize, this._imgSize);
//    this._image = new ImageData(this._imgSize, this._imgSize);
    for (let i = 0; i < this._image.data.length; i += 4) {
      this._image.data[i] = 0; // R
      this._image.data[i + 1] = 0; // G
      this._image.data[i + 2] = 0; // B
      this._image.data[i + 3] = 255; // A
    }

    // size of our height maps
    this._mapSize = 1024;

    // init height map 1
    
    for (let u = 0; u < this._mapSize; u++) {
      for (let v = 0; v < this._mapSize; v++) {
        // index of coordinate in height map array
        const i = u * this._mapSize + v;

        // u,v are coordinates with origin at upper left corner
        // cx and cy are coordinates with origin at the
        // center of the map
        const cx = u - this._mapSize / 2;
        const cy = v - this._mapSize / 2;

        // distance from middle of map
        const d = this.distance(cx, cy);
        // stretching so we get the desired ripple density on our map
        const stretch = (3 * Math.PI) / (this._mapSize / 2);

        // wavy height value between -1 and 1
        const ripple = Math.sin(d * stretch);

        // wavy height value normalized to 0..1
        const normalized = (ripple + 1) / 2;
        // height map value 0..128, integer
        this._heightMap1[i] = Math.floor(normalized * 128);
      }
    }
    for (let u = 0; u < this._mapSize; u++) {
      for (let v = 0; v < this._mapSize; v++) {
        const i = u * this._mapSize + v;
        const cx = u - this._mapSize / 2;
        const cy = v - this._mapSize / 2;

        // skewed distance as input to chaos field calculation,
        // scaled for smoothness over map distance
        const d1 = this.distance(0.8 * cx, 1.3 * cy) * 0.022;
        const d2 = this.distance(1.35 * cx, 0.45 * cy) * 0.022;

        const s = Math.sin(d1);
        const c = Math.cos(d2);
        // height value between -2 and +2
        const h = s + c;

        // height value between 0..1
        const normalized = (h + 2) / 4;
        // height value between 0..127, integer
        this._heightMap2[i] = Math.floor(normalized * 127);
      }
    }
      // two palettes we interpolate between
    this._palettes = [this.makeRandomPalette(), this.makeRandomPalette()];
  }
  distance (x, y) {
    return Math.sqrt(x * x + y * y);
  }

  // color helpers
  interpolate (c1, c2, f)  {
    return {
      r: Math.floor(c1.r + (c2.r - c1.r) * f),
      g: Math.floor(c1.g + (c2.g - c1.g) * f),
      b: Math.floor(c1.b + (c2.b - c1.b) * f)
    };
  };

  // returns a random color
  randomColor () {
    const r = Math.floor(Math.random() * 155+100);
    const g = Math.floor(Math.random() * 155);
    const b = Math.floor(Math.random() * 155);
    return { r, g, b };
  };

  // returns a random color palette with 256 color entries
  makeRandomPalette ()  {
    const c1 = this.randomColor();
    const c2 = this.randomColor();
    const c3 = this.randomColor();
    const c4 = this.randomColor();
    const c5 = this.randomColor();

    return this.makeFiveColorGradient(c1, c2, c3, c4, c5);
  };

  makeFiveColorGradient (c1, c2, c3, c4, c5) {
    const g = [];

    for (let i = 0; i < 64; i++) {
      const f = i / 64;
      g[i] = this.interpolate(c1, c2, f);
    }

    for (let i = 64; i < 128; i++) {
      const f = (i - 64) / 64;
      g[i] = this.interpolate(c2, c3, f);
    }

    for (let i = 128; i < 192; i++) {
      const f = (i - 128) / 64;
      g[i] = this.interpolate(c3, c4, f);
    }

    for (let i = 192; i < 256; i++) {
      const f = (i - 192) / 64;
      g[i] = this.interpolate(c4, c5, f);
    }

    return g;
  };

  // adjust height maps offsets
  moveHeightMaps (t) {
    this._dx1 = Math.floor(
      (((Math.cos(t * 0.0002 + 0.4 + Math.PI) + 1) / 2) * this._mapSize) / 2
    );
    this._dy1 = Math.floor((((Math.cos(t * 0.0003 - 0.1) + 1) / 2) * this._mapSize) / 2);
    this._dx2 = Math.floor((((Math.cos(t * -0.0002 + 1.2) + 1) / 2) * this._mapSize) / 2);
    this._dy2 = Math.floor(
      (((Math.cos(t * -0.0003 - 0.8 + Math.PI) + 1) / 2) * this._mapSize) / 2
    );
  };

  updatePalette (t) {
    const timeScale = 0.0005;
    const x = t * timeScale;

    // normalized value 0..1 used to interpolate palette colors
    const inter = (Math.cos(x) + 1) / 2;

    // did we switch direction, and should ergo pick a new palette
    // random palette to interpolate towards?

    const direction = -Math.sin(x) >= 0 ? 1 : -1;
    if (this._prevDirection != direction) {
      this._prevDirection = direction;
      if (direction == -1) {
        this._palettes[0] = this.makeRandomPalette();
      } else {
        this._palettes[1] = this.makeRandomPalette();
      }
    }

    // create interpolated palette for current frame
    for (let i = 0; i < 256; i++) {
      this._palette[i] = this.interpolate(this._palettes[0][i], this._palettes[1][i], inter);
    }
  };

  updateImageData () {
    for (let u = 0; u < this._imgSize; u++) {
      for (let v = 0; v < this._imgSize; v++) {
        // indexes into height maps for pixel
        const i =
          ((u * 512) / this._imgSize + this._dy1) * this._mapSize + ((v * 512) / this._imgSize + this._dx1);
        const k =
          ((u * 512) / this._imgSize + this._dy2) * this._mapSize + ((v * 512) / this._imgSize + this._dx2);

        // index for pixel in image data
        // remember it's 4 bytes per pixel
        const j = u * this._imgSize * 4 + v * 4;

        // height value of 0..255
        let h = this._heightMap1[i] + this._heightMap2[k];

        // get color value from current palette
        let c = this._palette[h];

        // h = heightMap2[i];
        // c = { r: h, g: h, b: h };

        // set pixel data
        this._image.data[j] = c.r;
        this._image.data[j + 1] = c.g;
        this._image.data[j + 2] = c.b;
      }
    }
  };

  // helper to create a linear gradient palette
  linearGradient (c1, c2) {
    const g = [];

    // interpolate between the colors
    // in the gradient

    for (let i = 0; i < 256; i++) {
      const f = i / 255;
      g[i] = this.interpolate(c1, c2, f);
    }
    return g;
  };

  plasmaUpdate = (myCTX) => {
    const time = new Date().getTime();
    this.moveHeightMaps(time);
    this.updatePalette(time);
    this.updateImageData();
    myCTX.putImageData(this._image, 0, 0);
  };
}
exports.Plasma = Plasma;
