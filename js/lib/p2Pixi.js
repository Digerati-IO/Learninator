
class p2Pixi {

  /**
   * @constructor
   * @param {Object} options
   */
  constructor(options) {
    var defaultOptions = {
      width: 1280,
      height: 720,
      pixelsPerLengthUnit: 128,
      useDeviceAspect: false
    };

    options = options || {};
    for (var key in options) {
      defaultOptions[key] = options[key];
    }

    if (defaultOptions.useDeviceAspect) {
      defaultOptions.height = (window.innerHeight / window.innerWidth) * defaultOptions.width;
    }

    this.zoom = 10;
    this.options = defaultOptions;
    this.pixelsPerLengthUnit = this.options.pixelsPerLengthUnit;

    this.stage = new PIXI.Container();
    this.container = new PIXI.Container();
    this.stage.addChild(this.container);

    this.setupRenderer();
    this.setupView();
  }

  /**
   * Adds the supplied shape to the supplied Container,
   * using vectors and / or a texture
   * @param  {Container} container
   * @param  {Shape} shape
   * @param  {Object} shapeOptions
   */
  addShape(container, shape, shapeOptions) {
    shapeOptions = shapeOptions || {};
    var offset = shapeOptions.offset || [0, 0],
        angle = shapeOptions.angle || 0,
        textureOptions = shapeOptions.textureOptions,
        styleOptions = shapeOptions.styleOptions,
        alpha = shapeOptions.alpha || 1,
        zero = [0, 0],
        ppu = this.pixelsPerLengthUnit;

    // If a Pixi texture has been specified...
    if (textureOptions) {
      var texture = textureOptions.texture,

          // Calculate the bounding box of the shape when at zero offset and 0 angle
          aabb = new p2.AABB();
      shape.computeAABB(aabb, zero, 0);

      // Get world coordinates of shape boundaries
      var left = aabb.lowerBound[0],
          bottom = aabb.lowerBound[1],
          right = aabb.upperBound[0],
          top = aabb.upperBound[1];

      // Cater for Heightfield shapes
      if (shape instanceof Heightfield) {
        bottom = -(this.options.height / ppu);
      }

      var width = right - left,
          height = top - bottom,
          // Create a Sprite or TilingSprite to cover the entire shape
          sprite;
      if (textureOptions.tile === false) {
        sprite = new PIXI.Sprite(texture);
      } else {
        sprite = new PIXI.extras.TilingSprite(texture, width * ppu, height * ppu);
      }
      sprite.alpha = alpha;
      // If the shape is anything other than a box, we need a mask for the texture.
      // We use the shape itself to create a new Graphics object.
      if (!(shape instanceof Box)) {
        var maskGraphics = new PIXI.Graphics();
        maskGraphics.renderable = false;
        maskGraphics.position.x = (offset[0] * ppu);
        maskGraphics.position.y = -(offset[1] * ppu);
        maskGraphics.rotation = -angle;
        this.renderShapeToGraphics(maskGraphics, shape, zero, 0,
            {
              lineWidth: 0,
              fillColor: 0xffffff
            });

        container.addChild(maskGraphics);
        sprite.mask = maskGraphics;
      }

      // Sprite positions are the top-left corner of the Sprite, whereas Graphics objects
      // are positioned at their origin
      if (angle === 0) {
        sprite.position.x = (left * ppu) + (offset[0] * ppu);
        sprite.position.y = -(top * ppu) - (offset[1] * ppu);
        sprite.rotation = -angle;

        container.addChild(sprite);
      } else {
        var doc = new PIXI.Container();
        sprite.position.x = (left * ppu);
        sprite.position.y = -(top * ppu);

        doc.addChild(sprite);
        doc.position.x = (offset[0] * ppu);
        doc.position.y = -(offset[1] * ppu);
        doc.rotation = -angle;

        doc.addChild(sprite);
        container.addChild(doc);
      }
    }

    // If any Pixi vector styles have been specified...
    if (styleOptions) {
      var graphics = new PIXI.Graphics();
      graphics.alpha = alpha;
      graphics.position.x = (offset[0] * ppu);
      graphics.position.y = -(offset[1] * ppu);
      graphics.rotation = -angle;

      this.renderShapeToGraphics(graphics, shape, zero, 0, styleOptions);

      container.addChild(graphics);
    }
  }

  /**
   * Draws a circle onto a PIXI.Graphics object
   * @param  {PIXI.Graphics} graphics
   * @param  {Number} x
   * @param  {Number} y
   * @param  {Number} radius
   * @param  {Object} style
   */
  drawCircle(graphics, x, y, radius, style) {
    style = style || {};
    var lineWidth = style.lineWidthUnits ? style.lineWidthUnits * this.pixelsPerLengthUnit : style.lineWidth || 0,
        lineColor = style.lineColor || 0x000000,
        fillColor = style.fillColor;

    graphics.lineStyle(lineWidth, lineColor, 1);
    if (fillColor) {
      graphics.beginFill(fillColor, 1);
    }
    graphics.drawCircle(x, y, radius);
    if (fillColor) {
      graphics.endFill();
    }
  }

  /**
   * Draws a finite plane onto a PIXI.Graphics object
   * @param  {PIXI.Graphics} graphics
   * @param  {Number} x0
   * @param  {Number} x1
   * @param  {Object} style
   */
  drawPlane(graphics, x0, x1, style) {
    style = style || {};
    var max = 1e6,
        lineWidth = style.lineWidthUnits ? style.lineWidthUnits * this.pixelsPerLengthUnit : style.lineWidth || 0,
        lineColor = style.lineColor || 0xFF0000,
        fillColor = style.fillColor;

    graphics.lineStyle(lineWidth, lineColor, 1);
    if (fillColor) {
      graphics.beginFill(fillColor, 1);
    }
    graphics.moveTo(-max, 0);
    graphics.lineTo(max, 0);
    graphics.lineTo(max, -max);
    graphics.lineTo(-max, -max);
    if (fillColor) {
      graphics.endFill();
    }
    // Draw the actual plane
    graphics.lineStyle(lineWidth, lineColor);
    graphics.moveTo(-max, 0);
    graphics.lineTo(max, 0);
  }

  /**
   * Draws a line onto a PIXI.Graphics object
   * @param  {PIXI.Graphics} graphics
   * @param  {Number} len
   * @param  {Object} style
   */
  drawLine(graphics, len, style) {
    style = style || {};
    var lineWidth = style.lineWidthUnits ? style.lineWidthUnits * this.pixelsPerLengthUnit : style.lineWidth || 1;
    var lineColor = style.lineColor || 0x000000;

    graphics.lineStyle(lineWidth, lineColor, 1);

    graphics.moveTo(-len / 2, 0);
    graphics.lineTo(len / 2, 0);
  }

  /**
   * Draws a capsule onto a PIXI.Graphics object
   * @param  {PIXI.Graphics} graphics
   * @param  {Number} x
   * @param  {Number} y
   * @param  {Number} angle
   * @param  {Number} len
   * @param  {Number} radius
   * @param  {Object} style
   */
  drawCapsule(graphics, x, y, angle, len, radius, style) {
    style = style || {};
    var c = Math.cos(angle),
        s = Math.sin(angle),
        lineWidth = style.lineWidthUnits ? style.lineWidthUnits * this.pixelsPerLengthUnit : style.lineWidth || 0,
        lineColor = style.lineColor || 0x000000,
        fillColor = style.fillColor;

    // Draw circles at ends
    graphics.lineStyle(lineWidth, lineColor, 1);
    if (fillColor) {
      graphics.beginFill(fillColor, 1);
    }
    graphics.drawCircle(-len / 2 * c + x, -len / 2 * s + y, radius);
    graphics.drawCircle(len / 2 * c + x, len / 2 * s + y, radius);
    if (fillColor) {
      graphics.endFill();
    }

    // Draw box
    graphics.lineStyle(lineWidth, lineColor, 0);
    if (fillColor) {
      graphics.beginFill(fillColor, 1);
    }
    graphics.moveTo(-len / 2 * c + radius * s + x, -len / 2 * s + radius * c + y);
    graphics.lineTo(len / 2 * c + radius * s + x, len / 2 * s + radius * c + y);
    graphics.lineTo(len / 2 * c - radius * s + x, len / 2 * s - radius * c + y);
    graphics.lineTo(-len / 2 * c - radius * s + x, -len / 2 * s - radius * c + y);
    if (fillColor) {
      graphics.endFill();
    }

    // Draw lines in between
    graphics.lineStyle(lineWidth, lineColor, 1);
    graphics.moveTo(-len / 2 * c + radius * s + x, -len / 2 * s + radius * c + y);
    graphics.lineTo(len / 2 * c + radius * s + x, len / 2 * s + radius * c + y);
    graphics.moveTo(-len / 2 * c - radius * s + x, -len / 2 * s - radius * c + y);
    graphics.lineTo(len / 2 * c - radius * s + x, len / 2 * s - radius * c + y);
  }

  /**
   * Draws a box onto a PIXI.Graphics object
   * @param  {PIXI.Graphics} graphics
   * @param  {Number} x
   * @param  {Number} y
   * @param  {Number} w
   * @param  {Number} h
   * @param  {Object} style
   */
  drawBox(graphics, x, y, w, h, style) {
    style = style || {};
    var lineWidth = style.lineWidthUnits ? style.lineWidthUnits * this.pixelsPerLengthUnit : style.lineWidth || 0,
        lineColor = style.lineColor || 0x000000,
        fillColor = style.fillColor;

    graphics.lineStyle(lineWidth, lineColor, 1);
    if (fillColor) {
      graphics.beginFill(fillColor, 1);
    }
    graphics.drawRect(x - w / 2, y - h / 2, w, h);
    if (fillColor) {
      graphics.endFill();
    }
  }

  /**
   * Draws a convex polygon onto a PIXI.Graphics object
   * @param  {PIXI.Graphics} graphics
   * @param  {Array} verts
   * @param  {Object} style
   */
  drawConvex(graphics, verts, style) {
    style = style || {};
    var lineWidth = style.lineWidthUnits ? style.lineWidthUnits * this.pixelsPerLengthUnit : style.lineWidth || 0,
        lineColor = style.lineColor || 0x000000,
        fillColor = style.fillColor;

    graphics.lineStyle(lineWidth, lineColor, 1);
    if (fillColor) {
      graphics.beginFill(fillColor, 1);
    }
    for (var i = 0; i !== verts.length; i++) {
      var v = verts[i],
          x = v[0],
          y = v[1];

      if (i === 0) {
        graphics.moveTo(x, y);
      } else {
        graphics.lineTo(x, y);
      }
    }

    if (fillColor) {
      graphics.endFill();
    }

    if (verts.length > 2 && lineWidth !== 0) {
      graphics.moveTo(verts[verts.length - 1][0], verts[verts.length - 1][1]);
      graphics.lineTo(verts[0][0], verts[0][1]);
    }
  }

  /**
   * Draws a path onto a PIXI.Graphics object
   * @param  {PIXI.Graphics} graphics
   * @param  {Array} path
   * @param  {Object} style
   */
  drawPath(graphics, path, style) {
    style = style || {};
    var lineWidth = style.lineWidthUnits ? style.lineWidthUnits * this.pixelsPerLengthUnit : style.lineWidth || 0,
        lineColor = style.lineColor || 0x000000,
        fillColor = style.fillColor, lastx = null,
        lasty = null;

    graphics.lineStyle(lineWidth, lineColor, 1);
    if (fillColor) {
      graphics.beginFill(fillColor, 1);
    }

    for (var i = 0; i < path.length; i++) {
      var v = path[i],
          x = v[0],
          y = v[1];

      if (x !== lastx || y !== lasty) {
        if (i === 0) {
          graphics.moveTo(x, y);
        } else {
          // Check if the lines are parallel
          var p1x = lastx,
              p1y = lasty,
              p2x = x,
              p2y = y,
              p3x = path[(i + 1) % path.length][0],
              p3y = path[(i + 1) % path.length][1],
              area = ((p2x - p1x) * (p3y - p1y)) - ((p3x - p1x) * (p2y - p1y));
          if (area !== 0) {
            graphics.lineTo(x, y);
          }
        }
        lastx = x;
        lasty = y;
      }
    }

    if (fillColor) {
      graphics.endFill();
    }
    // Close the path
    if (path.length > 2 && style.fillColor) {
      graphics.moveTo(path[path.length - 1][0], path[path.length - 1][1]);
      graphics.lineTo(path[0][0], path[0][1]);
    }
  }

  /**
   * Renders the supplied p2 Shape onto the supplied
   * Pixi Graphics object using the supplied Pixi style properties
   * @param  {PIXI.Graphics} graphics
   * @param  {p2.Shape} shape
   * @param  {p2.Vector} offset
   * @param  {Number} angle
   * @param  {Object} style
   */
  renderShapeToGraphics(graphics, shape, offset, angle, style) {
    let zero = [0, 0],
        ppu = this.pixelsPerLengthUnit;

    offset = offset || zero;
    angle = angle || 0;
    if (shape instanceof Circle) {
      this.drawCircle(graphics, offset[0] * ppu, -offset[1] * ppu, shape.radius * ppu, style);
    } else if (shape instanceof Particle) {
      let radius = Math.max(1, Math.round(ppu / 100));
      this.drawCircle(graphics, offset[0] * ppu, -offset[1] * ppu, radius, style);
    } else if (shape instanceof Plane) {
      // TODO: use shape angle
      this.drawPlane(graphics, -10 * ppu, 10 * ppu, style);
    } else if (shape instanceof Line) {
      this.drawLine(graphics, shape.length * ppu, style);
    } else if (shape instanceof Box) {
      this.drawBox(graphics, offset[0] * ppu, -offset[1] * ppu, shape.width * ppu, shape.height * ppu, style);
    } else if (shape instanceof Capsule) {
      this.drawCapsule(graphics, offset[0] * ppu, -offset[1] * ppu, angle, shape.length * ppu, shape.radius * ppu, style);
    } else if (shape instanceof Convex) {
      // Scale verts
      let verts = [],
          vrot = vec2.create();
      for (let i = 0; i < shape.vertices.length; i++) {
        let v = shape.vertices[i];
        vec2.rotate(vrot, v, angle);
        verts.push([(vrot[0] + offset[0]) * ppu, -(vrot[1] + offset[1]) * ppu]);
      }
      this.drawConvex(graphics, verts, style);
    } else if (shape instanceof Heightfield) {
      let path = [[0, 100 * ppu]],
          heights = shape.heights;
      for (let i = 0; i < heights.length; i++) {
        let h = heights[i];
        path.push([i * shape.elementWidth * ppu, -h * ppu]);
      }
      path.push([heights.length * shape.elementWidth * ppu, 100 * ppu]);
      this.drawPath(graphics, path, style);
    }
  }

  /**
   * Resizes the Pixi renderer's view to fit proportionally in the supplied window dimensions
   * @param  {Number} width
   * @param  {Number} height
   */
  resize(width, height) {
    let renderer = this.renderer,
        view = renderer.view,
        ratio = width / height,
        pixiRatio = renderer.width / renderer.height;

    this.windowWidth = width;
    this.windowHeight = height;
    if (ratio > pixiRatio) { // Screen is wider than the renderer
      this.viewCssWidth = height * pixiRatio;
      this.viewCssHeight = height;
      view.style.width = this.viewCssWidth + 'px';
      view.style.height = this.viewCssHeight + 'px';
      view.style.left = Math.round((width - this.viewCssWidth) / 2) + 'px';
      view.style.top = null;
    } else { // Screen is narrower
      this.viewCssWidth = width;
      this.viewCssHeight = Math.round(width / pixiRatio);
      view.style.width = this.viewCssWidth + 'px';
      view.style.height = this.viewCssHeight + 'px';
      view.style.left = null;
      view.style.top = Math.round((height - this.viewCssHeight) / 2) + 'px';
    }
  }

  /**
   * Sets up the Pixi renderer
   */
  setupRenderer() {
    var options = this.options;
    this.renderer = PIXI.autoDetectRenderer(options.width, options.height, options);
  }

  /**
   * Sets up the Pixi view
   */
  setupView() {
    var self = this,
        renderer = this.renderer,
        view = this.renderer.view,
        container = this.container;

    view.style.pos = "absolute";
    view.style.top = "0px";
    view.style.left = "0px";
    document.body.querySelector('#game-container').appendChild(view);

    this.viewCssWidth = 0;
    this.viewCssHeight = 0;
    this.windowWidth = window.innerWidth;
    this.windowHeight = window.innerHeight;

    container.position.x = renderer.width / 2;
    container.position.y = renderer.height / 2;

    if (this.options.resizable && this.options.autoResize) {
      this.resize(this.windowWidth, this.windowHeight);

      window.addEventListener('resize', resizeRenderer);
      window.addEventListener('orientationchange', resizeRenderer);

      function resizeRenderer() {
        self.resize(window.innerWidth, window.innerHeight);
      }
    }
  }

}