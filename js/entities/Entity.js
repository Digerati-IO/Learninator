(function (global) {
    "use strict";

    /**
     * Initialize the Entity
     *
     * @param {Number} typeId
     * @param {Vec} position
     * @param {Array} env
     * @param {Object} entityOpts
     * @constructor
     * @returns {Entity}
     */
    var Entity = function (typeId, position, env, entityOpts) {
        var entityTypes = ['Wall', 'Nom', 'Gnar', 'Agent'];

        this.id = Utility.guid();
        this.name = (this.name === undefined) ? entityTypes[typeId] : this.name;
        this.type = typeId || 1;
        this.position = position || new Vec(5, 5);
        this.width = entityOpts.width || 20;
        this.height = entityOpts.height || 20;
        this.radius = entityOpts.radius || 10;

        this.cheats = entityOpts.cheats || false;
        this.interactive = entityOpts.interactive || false;
        this.collision = entityOpts.collision || true;
        this.useSprite = entityOpts.useSprite || false;
        this.gridLocation = new Vec(0, 0);
        this.cleanUp = false;

        this.age = 0;
        this.angle = 0;
        this.rot1 = 0.0;
        this.rot2 = 0.0;

        // Remember the old position and angle
        this.oldPos = this.position.clone();
        this.oldAngle = 0;

        var _this = this;

        if (this.useSprite) {
            this.texture = PIXI.Texture.fromImage('img/' + entityTypes[typeId] + '.png');
            this.sprite = new PIXI.Sprite(this.texture);
            this.sprite.width = this.width;
            this.sprite.height = this.height;
            this.sprite.anchor.set(0.5, 0.5);
            this.sprite.position.set(this.position.x, this.position.y);
            this.sprite.interactive = this.interactive;

            if (this.sprite.interactive === true) {
                this.sprite
                    .on('mousedown', _this.onDragStart)
                    .on('touchstart', _this.onDragStart)
                    .on('mouseup', _this.onDragEnd)
                    .on('mouseupoutside', _this.onDragEnd)
                    .on('touchend', _this.onDragEnd)
                    .on('touchendoutside', _this.onDragEnd)
                    .on('mouseover', _this.onMouseOver)
                    .on('mouseout', _this.onMouseOut)
                    .on('mousemove', _this.onDragMove)
                    .on('touchmove', _this.onDragMove);
                this.sprite.entity = _this;
            }
        } else {
            this.shape = new PIXI.Graphics();
        }

        // If cheats are on then show the entities grid location and x,y coords
        if (this.cheats) {
            var fontOpts = {font: "10px Arial", fill: "#FF0000", align: "center"};
            if (this.useSprite === true) {
                this.sprite.addChild(new PIXI.Text());
                this.sprite.addChild(new PIXI.Text());
                this.sprite.addChild(new PIXI.Text());
            } else {
                this.shape.addChild(new PIXI.Text('', fontOpts));
                this.shape.addChild(new PIXI.Text('', fontOpts));
                this.shape.addChild(new PIXI.Text('', fontOpts));
            }

            if (this.cheats.gridLocation === true) {
                var gridText = new PIXI.Text(this.gridLocation.x + ':' + this.gridLocation.y, fontOpts);
                gridText.position.set(this.position.x + this.radius, this.position.y);
                if (this.useSprite === true) {
                    this.sprite.addChildAt(gridText, 0);
                } else {
                    this.shape.addChildAt(gridText, 0);
                }
            }

            if (this.cheats.position === true) {
                var posText = new PIXI.Text(this.position.x + ':' + this.position.y, fontOpts);
                posText.position.set(this.position.x + this.radius, this.position.y + this.radius);
                if (this.useSprite === true) {
                    this.sprite.addChildAt(posText, 1);
                } else {
                    this.shape.addChildAt(posText, 1);
                }
            }

            if (this.cheats.name === true) {
                var name = new PIXI.Text(this.name, fontOpts);
                name.position.set(this.position.x + this.radius, this.position.y + (this.radius * 2));
                if (this.useSprite === true) {
                    this.sprite.addChildAt(name, 2);
                } else {
                    this.shape.addChildAt(name, 2);
                }
            }
        }

        return this;
    };

    /**
     * Draws it
     *
     * @returns {Entity}
     */
    Entity.prototype.draw = function () {
        if (this.useSprite) {
            this.sprite.position.set(this.position.x, this.position.y);
            this.sprite.rotation = -this.angle;
        } else {
            this.shape.clear();
            this.shape.lineStyle(1, 0x000000);

            switch (this.type) {
            case 1:
                this.shape.beginFill(0xFF0000);
                break;
            case 2:
                this.shape.beginFill(0x00FF00);
                break;
            case 3:
                this.shape.beginFill(0x0000FF);
                break;
            }
            this.shape.drawCircle(this.position.x, this.position.y, this.radius);
            this.shape.endFill();
        }

        return this;
    };

    /**
     * Move around
     * @returns {Entity}
     */
    Entity.prototype.move = function () {
        this.oldPos = this.position.clone();

        if (this.position.x < 1) {
            this.position.x = 1;
            this.position.vx *= -1;
        }
        if (this.position.x > this.world.width - 1) {
            this.position.x = this.world.width - 1;
            this.position.vx *= -1;
        }
        if (this.position.y < 1) {
            this.position.y = 1;
            this.position.vy *= -1;
        }
        if (this.position.y > this.world.height - 1) {
            this.position.y = this.world.height - 1;
            this.position.vy *= -1;
        }

        // Move the items
        this.position.advance();
        this.position.round();

        if (this.useSprite) {
            this.sprite.position.set(this.position.x, this.position.y);
        }

        return this;
    };

    /**
     * Do work son
     *
     * @param {Object} world
     * @returns {Entity}
     */
    Entity.prototype.tick = function (world) {
        this.world = world;
        this.age += 1;

        if (this.world.movingEntities) {
            this.move();
        }

        if (this.cheats) {
            var child;
            // If cheats are on then show the entities grid location and x,y coords
            if (this.cheats.gridLocation === true) {
                if (this.useSprite) {
                    child = this.sprite.getChildAt(0);
                } else {
                    child = this.shape.getChildAt(0);
                }
                child.text = this.gridLocation.x + ':' + this.gridLocation.y;
                child.position.set(this.position.x + this.radius, this.position.y + (this.radius));
            }
            if (this.cheats.position === true) {
                if (this.useSprite) {
                    child = this.sprite.getChildAt(1);
                } else {
                    child = this.shape.getChildAt(1);
                }
                child.text = this.position.x + ':' + this.position.y;
                child.position.set(this.position.x + this.radius, this.position.y + (this.radius * 1));
            }
            if (this.cheats.name === true) {
                if (this.useSprite) {
                    child = this.sprite.getChildAt(2);
                } else {
                    child = this.shape.getChildAt(2);
                }
                child.position.set(this.position.x + this.radius, this.position.y + (this.radius * 2));
            }
        }

        return this;
    };

    /**
     * Perform the start of a drag
     *
     * @param {MouseEvent} event
     * @returns {Entity}
     */
    Entity.prototype.onDragStart = function (event) {
        this.data = event.data;
        this.alpha = 0.5;
        this.dragging = true;

        return this;
    };

    /**
     * Perform the move of a drag
     *
     * @returns {Entity}
     */
    Entity.prototype.onDragMove = function () {
        if (this.dragging) {
            var newPosition = this.data.getLocalPosition(this.parent);
            this.position.set(newPosition.x, newPosition.y);
            this.entity.position.set(newPosition.x, newPosition.y);
            this.entity.position.round();
        }

        return this;
    };

    /**
     * Perform the end of a drag
     *
     * @returns {Entity}
     */
    Entity.prototype.onDragEnd = function () {
        this.alpha = 1;
        this.dragging = false;
        this.entity.position.set(this.position.x, this.position.y);
        this.entity.position.round();
        // set the interaction data to null
        this.data = null;

        return this;
    };

    /**
     * Perform the action for mouse down
     *
     * @returns {Entity}
     */
    Entity.prototype.onMouseDown = function () {
        this.isdown = true;
        this.alpha = 1;

        return this;
    };

    /**
     * Perform the action for mouse up
     *
     * @returns {Entity}
     */
    Entity.prototype.onMouseUp = function () {
        this.isdown = false;

        return this;
    };

    /**
     * Perform the action for mouse over
     *
     * @returns {Entity}
     */
    Entity.prototype.onMouseOver = function () {
        this.isOver = true;
        if (this.isdown) {
            return this;
        }

        return this;
    };

    /**
     * Perform the action for mouse out
     *
     * @returns {Entity}
     */
    Entity.prototype.onMouseOut = function () {
        this.isOver = false;
        if (this.isdown) {
            return this;
        }

        return this;
    };

    global.Entity = Entity;

}(this));
