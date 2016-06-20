(function (global) {
    "use strict";

    var vec2 = p2.vec2,
        Body = p2.Body,
        Circle = p2.Circle,
        Capsule = p2.Capsule,
        Convex = p2.Convex,
        Plane = p2.Plane,
        Box = p2.Box,
        Particle = p2.Particle,
        Line = p2.Line,
        Heightfield = p2.Heightfield,
        EventEmitter = p2.EventEmitter;

    class PixiAdapter {

        /**
         * Creates a new PixiAdapter instance
         */
        constructor(options) {
            var key, settings = {
                pixelsPerLengthUnit: 128,
                width: 1280,
                height: 720,
                transparent: false,
                antialias: true,
                useDeviceAspect: false,
                webGLEnabled: true,
                useDevicePixels: true
            };

            options = options || {};

            for (key in options) {
                settings[key] = options[key];
            }

            if (settings.useDeviceAspect) {
                settings.height = (window.innerHeight / window.innerWidth) * settings.width;
            }

            this.settings = settings;
            this.pixelsPerLengthUnit = settings.pixelsPerLengthUnit;

            EventEmitter.call(this);

            this.stage = new PIXI.Container();
            this.container = new PIXI.Container();
            this.stage.addChild(this.container);

            this.setDeviceProperties();
            this.setupRenderer();
            this.setupView();
        }
    }

    PixiAdapter.prototype = new EventEmitter();

    /**
     * Reads and stores device properties
     */
    PixiAdapter.prototype.setDeviceProperties = function () {
        var settings = this.settings;

        this.devicePixelRatio = settings.useDevicePixels ? (window.devicePixelRatio || 1) : 1;
        this.deviceScale = (this.devicePixelRatio !== 1 ? (Math.round(Math.max(screen.width, screen.height) * this.devicePixelRatio) / Math.max(settings.width, settings.height)) : 1);
    };

    /**
     * Sets up the Pixi renderer
     */
    PixiAdapter.prototype.setupRenderer = function () {
        var settings = this.settings, deviceScale = this.deviceScale;

        this.renderer = settings.webGLEnabled
            ? PIXI.autoDetectRenderer(settings.width * deviceScale, settings.height * deviceScale, settings)
            : new PIXI.CanvasRenderer(settings.width * deviceScale, settings.height * deviceScale, settings);
    };

    /**
     * Sets up the Pixi view
     */
    PixiAdapter.prototype.setupView = function () {
        var self = this,
            renderer = this.renderer,
            view = this.renderer.view,
            container = this.container,
            deviceScale = this.deviceScale;

        view.style.position = 'absolute';

        document.body.appendChild(this.renderer.view);

        this.windowWidth = window.innerWidth;
        this.windowHeight = window.innerHeight;

        container.position.x = renderer.width / 2;
        container.position.y = renderer.height / 2;

        container.scale.x = deviceScale;
        container.scale.y = deviceScale;

        this.viewCssWidth = 0;
        this.viewCssHeight = 0;
        this.resize(this.windowWidth, this.windowHeight);

        window.addEventListener('resize', resizeRenderer);
        window.addEventListener('orientationchange', resizeRenderer);

        function resizeRenderer() {
            self.resize(window.innerWidth, window.innerHeight);
        }
    };

    /**
     * Draws a circle onto a PIXI.Graphics object
     * @param  {PIXI.Graphics} graphics
     * @param  {Number} x
     * @param  {Number} y
     * @param  {Number} radius
     * @param  {object} style
     */
    PixiAdapter.prototype.drawCircle = function (graphics, x, y, radius, style) {
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
    };

    /**
     * Draws a finite plane onto a PIXI.Graphics object
     * @param  {PIXI.Graphics} graphics
     * @param  {Number} x0
     * @param  {Number} x1
     * @param  {Number} color
     * @param  {object} style
     */
    PixiAdapter.prototype.drawPlane = function (graphics, x0, x1, color, style) {
        style = style || {};
        var max = 1e6,
            lineWidth = style.lineWidthUnits ? style.lineWidthUnits * this.pixelsPerLengthUnit : style.lineWidth || 0, lineColor = style.lineColor || 0x000000, fillColor = style.fillColor;

        graphics.lineStyle(lineWidth, lineColor, 1);
        if (fillColor) {
            graphics.beginFill(fillColor, 1);
        }

        graphics.moveTo(-max, 0);
        graphics.lineTo(max, 0);
        graphics.lineTo(max, max);
        graphics.lineTo(-max, max);
        if (fillColor) {
            graphics.endFill();
        }

        // Draw the actual plane
        graphics.lineStyle(lineWidth, lineColor);
        graphics.moveTo(-max, 0);
        graphics.lineTo(max, 0);
    };

    /**
     * Draws a line onto a PIXI.Graphics object
     * @param  {PIXI.Graphics} graphics
     * @param  {Number} len
     * @param  {object} style
     */
    PixiAdapter.prototype.drawLine = function (graphics, len, style) {
        style = style || {};
        var lineWidth = style.lineWidthUnits ? style.lineWidthUnits * this.pixelsPerLengthUnit : style.lineWidth || 1, lineColor = style.lineColor || 0x000000;

        graphics.lineStyle(lineWidth, lineColor, 1);
        graphics.moveTo(-len / 2, 0);
        graphics.lineTo(len / 2, 0);
    };

    /**
     * Draws a capsule onto a PIXI.Graphics object
     * @param  {PIXI.Graphics} graphics
     * @param  {Number} x
     * @param  {Number} y
     * @param  {Number} angle
     * @param  {Number} len
     * @param  {Number} radius
     * @param  {object} style
     */
    PixiAdapter.prototype.drawCapsule = function (graphics, x, y, angle, len, radius, style) {
        style = style || {};
        var c = Math.cos(angle), s = Math.sin(angle), lineWidth = style.lineWidthUnits ? style.lineWidthUnits * this.pixelsPerLengthUnit : style.lineWidth || 0, lineColor = style.lineColor || 0x000000, fillColor = style.fillColor;

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
    };

    /**
     * Draws a box onto a PIXI.Graphics object
     * @param  {PIXI.Graphics} graphics
     * @param  {Number} x
     * @param  {Number} y
     * @param  {Number} w
     * @param  {Number} h
     * @param  {object} style
     */
    PixiAdapter.prototype.drawRectangle = function (graphics, x, y, w, h, style) {
        style = style || {};
        var lineWidth = style.lineWidthUnits ? style.lineWidthUnits * this.pixelsPerLengthUnit : style.lineWidth || 0, lineColor = style.lineColor || 0x000000, fillColor = style.fillColor;

        graphics.lineStyle(lineWidth, lineColor, 1);
        if (fillColor) {
            graphics.beginFill(fillColor, 1);
        }

        graphics.drawRect(x - w / 2, y - h / 2, w, h);
        if (fillColor) {
            graphics.endFill();
        }
    };

    /**
     * Draws a convex polygon onto a PIXI.Graphics object
     * @param  {PIXI.Graphics} graphics
     * @param  {Array} vertices
     * @param  {object} style
     */
    PixiAdapter.prototype.drawConvex = function (graphics, vertices, style) {
        style = style || {};
        var lineWidth = style.lineWidthUnits ? style.lineWidthUnits * this.pixelsPerLengthUnit : style.lineWidth || 0, lineColor = style.lineColor || 0x000000, fillColor = style.fillColor;

        graphics.lineStyle(lineWidth, lineColor, 1);
        if (fillColor) {
            graphics.beginFill(fillColor, 1);
        }

        for (var i = 0; i !== vertices.length; i++) {
            var v = vertices[i],
                x = v[0],
                y = v[1];
            if (i == 0) {
                graphics.moveTo(x, y);
            } else {
                graphics.lineTo(x, y);
            }
        }

        if (fillColor) {
            graphics.endFill();
        }

        if (vertices.length > 2 && lineWidth !== 0) {
            graphics.moveTo(vertices[vertices.length - 1][0], vertices[vertices.length - 1][1]);
            graphics.lineTo(vertices[0][0], vertices[0][1]);
        }
    };

    /**
     * Draws a path onto a PIXI.Graphics object
     * @param  {PIXI.Graphics} graphics
     * @param  {Array} path
     * @param  {object} style
     */
    PixiAdapter.prototype.drawPath = function (graphics, path, style) {
        var style = style || {}, lineWidth = style.lineWidthUnits ? style.lineWidthUnits * this.pixelsPerLengthUnit : style.lineWidth || 0, lineColor = style.lineColor || 0x000000, fillColor = style.fillColor;

        graphics.lineStyle(lineWidth, lineColor, 1);
        if (fillColor) {
            graphics.beginFill(fillColor, 1);
        }

        var lastx = null,
            lasty = null;
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
                        p3y = path[(i + 1) % path.length][1];
                    var area = ((p2x - p1x) * (p3y - p1y)) - ((p3x - p1x) * (p2y - p1y));
                    if (area !== 0)
                        graphics.lineTo(x, y);
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
    };

    /**
     * Renders the supplied p2 Shape onto the supplied Pixi Graphics object using the supplied Pixi style properties
     * @param  {PIXI.Graphics} graphics
     * @param  {Shape} shape
     * @param  {Vector} offset
     * @param  {Number} angle
     * @param  {Object} style
     */
    PixiAdapter.prototype.renderShapeToGraphics = function (graphics, shape, offset, angle, style) {
        var zero = [0, 0], ppu = this.pixelsPerLengthUnit, verts, vrot, path, heights, i, v;

        offset = offset || zero;
        angle = angle || 0;
        if (shape instanceof Circle) {
            this.drawCircle(graphics, offset[0] * ppu, -offset[1] * ppu, shape.radius * ppu, style);

        } else if (shape instanceof Particle) {
            this.drawCircle(graphics, offset[0] * ppu, -offset[1] * ppu, 2 * lw, style);

        } else if (shape instanceof Plane) {
            // TODO: use shape angle
            this.drawPlane(graphics, -10 * ppu, 10 * ppu, style);

        } else if (shape instanceof Line) {
            this.drawLine(graphics, shape.length * ppu, style);

        } else if (shape instanceof Box) {
            this.drawRectangle(graphics, offset[0] * ppu, -offset[1] * ppu, shape.width * ppu, shape.height * ppu, style);

        } else if (shape instanceof Capsule) {
            this.drawCapsule(graphics, offset[0] * ppu, -offset[1] * ppu, angle, shape.length * ppu, shape.radius * ppu, style);

        } else if (shape instanceof Convex) {
            // Scale verts
            verts = [];
            vrot = vec2.create();

            for (i = 0; i < shape.vertices.length; i++) {
                v = shape.vertices[i];
                vec2.rotate(vrot, v, angle);
                verts.push([(vrot[0] + offset[0]) * ppu, -(vrot[1] + offset[1]) * ppu]);
            }

            this.drawConvex(graphics, verts, style);
        } else if (shape instanceof Heightfield) {
            path = [[0, 100 * ppu]];
            heights = shape.heights;

            for (i = 0; i < heights.length; i++) {
                v = heights[i];
                path.push([i * shape.elementWidth * ppu, -v * ppu]);
            }

            path.push([heights.length * shape.elementWidth * ppu, 100 * ppu]);
            this.drawPath(graphics, path, style);
        }
    };

    /**
     * Adds the supplied shape to the supplied Container, using vectors and / or a texture
     * @param  {PIXI.Container} container
     * @param  {Shape} shape
     * @param  {Vector} offset
     * @param  {Number} angle
     * @param  {Object} style
     * @param  {Texture} texture
     * @param  {Number} alpha
     */
    PixiAdapter.prototype.addShape = function (container, shape, offset, angle, style, texture, alpha, textureOptions) {

        var zero = [0, 0], graphics, sprite, doc, ppu = this.pixelsPerLengthUnit, aabb, width, height, left, top, right, bottom, maskGraphics, textureOptions = textureOptions || {};

        // If a Pixi texture has been specified...
        if (texture) {
            // Calculate the bounding box of the shape when at zero offset and 0 angle
            aabb = new p2.AABB();
            shape.computeAABB(aabb, zero, 0);

            // Get world coordinates of shape boundaries
            left = aabb.lowerBound[0];
            bottom = aabb.lowerBound[1];
            right = aabb.upperBound[0];
            top = aabb.upperBound[1];

            // Cater for Heightfield shapes
            if (shape instanceof Heightfield) {
                bottom = -(this.settings.height / ppu);
            }

            width = right - left;
            height = top - bottom;

            // Create a Sprite or TilingSprite to cover the entire shape
            if (textureOptions.tile === false) {
                sprite = new PIXI.Sprite(texture);
            } else {
                sprite = new PIXI.extras.TilingSprite(texture, width * ppu, height * ppu);
            }

            sprite.alpha = alpha || 1;

            // If the shape is anything other than a box, we need a mask for the texture.
            // We use the shape itself to create a new Graphics object.
            if (!(shape instanceof Box)) {
                maskGraphics = new PIXI.Graphics();
                maskGraphics.renderable = false;
                maskGraphics.position.x = (offset[0] * ppu);
                maskGraphics.position.y = -(offset[1] * ppu);
                maskGraphics.rotation = -angle;

                this.renderShapeToGraphics(maskGraphics, shape, zero, 0, {lineWidth: 0, fillColor: 0xffffff});

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
                sprite.position.x = (left * ppu);
                sprite.position.y = -(top * ppu);

                doc = new PIXI.Container();
                doc.addChild(sprite);
                doc.position.x = (offset[0] * ppu);
                doc.position.y = -(offset[1] * ppu);
                doc.rotation = -angle;

                doc.addChild(sprite);
                container.addChild(doc);
            }
        }

        // If any Pixi vector styles have been specified...
        if (style) {
            graphics = new PIXI.Graphics();
            graphics.alpha = alpha || 1;
            graphics.position.x = (offset[0] * ppu);
            graphics.position.y = -(offset[1] * ppu);
            graphics.rotation = -angle;

            this.renderShapeToGraphics(graphics, shape, zero, 0, style);

            container.addChild(graphics);
        }
    };

    /**
     * Resizes the Pixi renderer's view to fit proportionally in the supplied window dimensions
     * @param  {Number} w
     * @param  {Number} h
     */
    PixiAdapter.prototype.resize = function (w, h) {
        var renderer = this.renderer, view = renderer.view, ratio = w / h, pixiRatio = renderer.width / renderer.height;

        this.windowWidth = w;
        this.windowHeight = h;
        if (ratio > pixiRatio) { // Screen is wider than the renderer
            this.viewCssWidth = h * pixiRatio;
            this.viewCssHeight = h;

            view.style.width = this.viewCssWidth + 'px';
            view.style.height = this.viewCssHeight + 'px';

            view.style.left = Math.round((w - this.viewCssWidth) / 2) + 'px';
            view.style.top = null;
        } else { // Screen is narrower
            this.viewCssWidth = w;
            this.viewCssHeight = Math.round(w / pixiRatio);

            view.style.width = this.viewCssWidth + 'px';
            view.style.height = this.viewCssHeight + 'px';

            view.style.left = null;
            view.style.top = Math.round((h - this.viewCssHeight) / 2) + 'px';
        }
    };

    global.PixiAdapter = PixiAdapter;

}(this));