(function (global) {
    "use strict";

    /**
     * Options for the cheats to display
     * @typedef {Object} cheatOpts
     * @property {boolean} position - Show Vec x, y
     * @property {boolean} name - Show the name
     * @property {boolean} id - Show the ID
     * @property {boolean} gridLocation - Show the gridLocation x, y
     */

    /**
     * Options for the Entity
     * @typedef {Object} entityOpts
     * @property {number} radius - The radius of the Entity
     * @property {number} width - The width of the Entity
     * @property {number} height - The height of the Entity
     * @property {boolean} interactive - Is it interactive
     * @property {boolean} collision - Does it collide with stuff
     * @property {boolean} movingEntities - Does it move
     * @property {boolean} useSprite - Should it use a sprite
     * @property {cheatOpts} cheats - The cheats to display
     */

    class Entity {
        /**
         * Initialize the Entity
         * @name Entity
         * @constructor
         *
         * @param {number|string} type A type id (wall,nom,gnar,agent)
         * @param {Vec} position - The x, y location
         * @param {entityOpts} opts - The Entity options
         * @param {cheatOpts} opts.cheats - The cheats to display
         * @returns {Entity}
         */
        constructor(type, position = new Vec(5, 5), opts) {
            this.entityTypes = ['Wall', 'Nom', 'Gnar', 'Agent', 'Agent Worker', 'Entity Agent'];
            this.styles = ['black', 'red', 'green', 'blue', 'navy', 'magenta', 'cyan', 'purple', 'aqua', 'olive', 'lime'];
            this.hexStyles = [0x000000, 0xFF0000, 0x00FF00, 0x0000FF, 0x000080, 0xFF00FF, 0x00FFFF, 0x800080, 0x00FFFF, 0x808000, 0x00FF00];

            let typeOf = typeof type;
            if (typeOf === 'string') {
                this.type = this.entityTypes.indexOf(type);
                this.typeName = type;
                this.color = this.hexStyles[this.type];
                this.legendColor = this.styles[this.type];
                this.name = (this.name === undefined) ? type : this.name;
            } else if (typeOf === 'number') {
                this.type = type || 1;
                this.typeName = this.entityTypes[this.type];
                this.color = this.hexStyles[this.type];
                this.legendColor = this.styles[this.type];
                this.name = (this.name === undefined) ? this.entityTypes[this.type] : this.name;
            }

            this.id = Utility.guid();
            this.options = opts || {
                    radius: 10,
                    collision: true,
                    interactive: false,
                    useSprite: false,
                    moving: true,
                    cheats: {
                        name: false,
                        id: false,
                        direction: false,
                        gridLocation: false,
                        position: false
                    }
                };
            // Remember the old position and angle
            this.position = position;
            this.oldPosition = this.position.clone();
            this.oldAngle = this.position.angle;

            this.radius = Utility.getOpt(this.options, 'radius', undefined);
            this.width = Utility.getOpt(this.options, 'width', undefined);
            this.height = Utility.getOpt(this.options, 'height', undefined);
            this.size = this.radius * 2 || this.width;
            this.interactive = Utility.getOpt(this.options, 'interactive', false);
            this.collision = Utility.getOpt(this.options, 'collision', true);
            this.moving = Utility.getOpt(this.options, 'moving', false);
            this.useSprite = Utility.getOpt(this.options, 'useSprite', false);

            this.cheats = Utility.getOpt(this.options, 'cheats', false);
            this.direction = Utility.getDirection(this.position.getAngle(true));

            this.age = 0;
            this.speed = 1;
            this.force = new Vec(0, 0);
            this.rot1 = 0.0;
            this.rot2 = 0.0;
            this.collisions = [];
            this.gridLocation = {};
            this.cleanUp = false;

            // Add a container to hold our display cheats
            this.cheatsContainer = new PIXI.Container();
            this.addCheats();

            let entity;
            if (this.useSprite) {
                this.texture = PIXI.Texture.fromImage('img/' + this.typeName.replace(' ', '') + '.png');
                this.sprite = new PIXI.Sprite(this.texture);
                this.sprite.width = this.width;
                this.sprite.height = this.height;
                this.sprite.anchor.set(0.5, 0.5);
                this.sprite.position.set(this.position.x, this.position.y);
                this.sprite.addChild(this.cheatsContainer);
                entity = this.sprite;
            } else {
                this.shape = new PIXI.Graphics();
                this.shape.addChild(this.cheatsContainer);
                entity = this.shape;
            }

            if (this.interactive === true) {
                this.isOver = false;
                this.isDown = false;
                entity.interactive = true;
                entity
                    .on('mousedown', (e, data) => {
                        this.onDragStart(e);
                    })
                    .on('touchstart', (e, data) => {
                        this.onDragStart(e);
                    })
                    .on('mouseup', (e, data) => {
                        this.onDragEnd();
                    })
                    .on('mouseupoutside', (e, data) => {
                        this.onDragEnd();
                    })
                    .on('touchend', (e, data) => {
                        this.onDragEnd();
                    })
                    .on('touchendoutside', (e, data) => {
                        this.onDragEnd();
                    })
                    .on('mouseover', (e, data) => {
                        this.onMouseOver();
                    })
                    .on('mouseout', (e, data) => {
                        this.onMouseOut();
                    })
                    .on('mousemove', (e, data) => {
                        this.onDragMove();
                    })
                    .on('touchmove', (e, data) => {
                        this.onDragMove();
                    });
            }

            return this;
        }

        /**
         * Set up the cheat displays
         * @returns {Entity}
         */
        addCheats() {
            let fontOpts = {font: "10px Arial", fill: "#FF0000", align: "center"};

            // If cheats are on then show the entities grid location and x,y coords
            if (this.cheats.gridLocation && this.gridText === undefined) {
                let textG = ' Grid(' + this.gridLocation.x + ',' + this.gridLocation.y + ')';

                this.gridText = new PIXI.Text(textG, fontOpts);
                this.gridText.position.set(this.position.x + this.radius, this.position.y - (this.radius * 2));
                this.cheatsContainer.addChild(this.gridText);
            }

            // If cheats are on then show the entities position and velocity
            if (this.cheats.position && this.posText === undefined) {
                let textP = ' Pos(' + this.position.x + ', ' + this.position.y + ')',
                    textV = ' Vel(' + Utility.flt2str(this.position.vx, 4) + ', ' + Utility.flt2str(this.position.vy, 4) + ')';

                this.posText = new PIXI.Text(textP + textV, fontOpts);
                this.posText.position.set(this.position.x + this.radius, this.position.y - this.radius);
                this.cheatsContainer.addChild(this.posText);
            }

            // If cheats are on then show the entities name
            if (this.cheats.name && this.nameText === undefined) {
                this.nameText = new PIXI.Text(this.name, fontOpts);
                this.nameText.position.set(this.position.x + this.radius, this.position.y + this.radius);
                this.cheatsContainer.addChild(this.nameText);
            }

            // If cheats are on then show the entities id
            if (this.cheats.id && this.idText === undefined) {
                this.idText = new PIXI.Text(this.id.substring(0, 10), fontOpts);
                this.idText.position.set(this.position.x + this.radius, this.position.y + (this.radius * 2));
                this.cheatsContainer.addChild(this.idText);
            }

            // If cheats are on then show the entities id
            if (this.cheats.direction && this.directionText === undefined) {
                this.directionText = new PIXI.Text(this.direction, fontOpts);
                this.directionText.position.set(this.position.x + this.radius, this.position.y + (this.radius * 2));
                this.cheatsContainer.addChild(this.directionText);
            }

            return this;
        }

        /**
         * Update the cheats if they are on
         * @returns {Entity}
         */
        updateCheats() {
            let posText, gridText, nameText, idText, directionText;
            // If cheats are on then show the entities grid location and x,y coords
            if (this.cheats.gridLocation) {
                if (this.gridText === undefined) {
                    this.addCheats();
                }
                gridText = this.cheatsContainer.getChildAt(this.cheatsContainer.getChildIndex(this.gridText));
                gridText.text = '(' + this.gridLocation.toString() + ')';
                gridText.position.set(this.position.x + this.radius, this.position.y + (this.radius));
            } else {
                if (this.gridText !== undefined) {
                    let index = this.cheatsContainer.getChildIndex(this.gridText);
                    this.cheatsContainer.removeChildAt(index);
                    this.gridText = undefined;
                }
            }

            // If cheats are on then show the entities position and velocity
            if (this.cheats.position) {
                if (this.posText === undefined) {
                    this.addCheats();
                }
                let textP = ' Pos(' + this.position.x + ', ' + this.position.y + ')',
                    textV = ' Vel(' + Utility.flt2str(this.position.vx, 4) + ', ' + Utility.flt2str(this.position.vy, 4) + ')';
                posText = this.cheatsContainer.getChildAt(this.cheatsContainer.getChildIndex(this.posText));
                posText.text = textP + textV;
                posText.position.set(this.position.x + this.radius, this.position.y + (this.radius * 1));
            } else {
                if (this.posText !== undefined) {
                    let index = this.cheatsContainer.getChildIndex(this.posText);
                    this.cheatsContainer.removeChildAt(index);
                    this.posText = undefined;
                }
            }

            // If cheats are on then show the entities name
            if (this.cheats.name) {
                if (this.nameText === undefined) {
                    this.addCheats();
                }
                nameText = this.cheatsContainer.getChildAt(this.cheatsContainer.getChildIndex(this.nameText));
                nameText.position.set(this.position.x + this.radius, this.position.y + (this.radius * 2));
            } else {
                if (this.nameText !== undefined) {
                    let index = this.cheatsContainer.getChildIndex(this.nameText);
                    this.cheatsContainer.removeChildAt(index);
                    this.nameText = undefined;
                }
            }

            // If cheats are on then show the entities id
            if (this.cheats.id) {
                if (this.idText === undefined) {
                    this.addCheats();
                }
                idText = this.cheatsContainer.getChildAt(this.cheatsContainer.getChildIndex(this.idText));
                idText.position.set(this.position.x + this.radius, this.position.y + (this.radius * 3));
            } else {
                if (this.idText !== undefined) {
                    let index = this.cheatsContainer.getChildIndex(this.idText);
                    this.cheatsContainer.removeChildAt(index);
                    this.idText = undefined;
                }
            }

            // If cheats are on then show the entities direction
            if (this.cheats.direction) {
                if (this.directionText === undefined) {
                    this.addCheats();
                }
                directionText = this.cheatsContainer.getChildAt(this.cheatsContainer.getChildIndex(this.directionText));
                directionText.text = this.direction;
                directionText.position.set(this.position.x + this.radius, this.position.y + (this.radius * 4));
            } else {
                if (this.directionText !== undefined) {
                    let index = this.cheatsContainer.getChildIndex(this.directionText);
                    this.cheatsContainer.removeChildAt(index);
                    this.directionText = undefined;
                }
            }

            return this;
        }

        /**
         * Draws it
         * @returns {Entity}
         */
        draw() {
            if (this.useSprite) {
                this.sprite.position.set(this.position.x, this.position.y);
            } else {
                this.shape.clear();
                this.shape.lineStyle(1, 0x000000);
                this.shape.beginFill(this.color);
                this.shape.drawCircle(this.position.x, this.position.y, this.radius);
                this.shape.endFill();
                if (this.cheats.direction) {
                    let dirV = new Vec(
                        this.position.x + this.radius * Math.sin(this.position.direction),
                        this.position.y + this.radius * Math.cos(this.position.direction)
                    );
                    this.shape.lineStyle(2, 0x000000, 2);
                    this.shape.moveTo(this.position.x, this.position.y);
                    this.shape.lineTo(dirV.x, dirV.y);
                }
            }

            if (this.cheats) {
                this.updateCheats();
            }

            return this;
        }

        /**
         * Move around
         * @returns {Entity}
         */
        move() {
            this.oldPosition = this.position.clone();
            this.oldAngle = this.position.angle;

            for (let i = 0; i < this.collisions.length; i++) {
                let collisionObj = this.collisions[i];
                if (collisionObj.distance <= this.radius) {
                    switch (collisionObj.type) {
                        case 0:
                            // Wall
                            // Get the vector that points out from the surface the circle is bouncing on.
                            let bounceLineNormal = this.position.vectorBetween(this.position, collisionObj.vecI).unitVector(),
                            // Set the new circle velocity by reflecting the old velocity in `bounceLineNormal`.
                                dot = this.position.vx * bounceLineNormal.x + this.position.vy * bounceLineNormal.y;

                            this.force.x -= 2 * dot * bounceLineNormal.x;
                            this.force.y -= 2 * dot * bounceLineNormal.y;

                            if (this.force.x > 2 || this.force.y > 2 || this.force.x < -2 || this.force.y < -2) {
                                this.force.scale(0.095);
                            }
                            break;
                        case 1:
                        case 2:
                            // Noms or Gnars
                            this.force.x = collisionObj.target.vx;
                            this.force.y = collisionObj.target.vy;
                            break;
                        case 3:
                        case 4:
                            break;
                    }
                }
            }

            // Execute entity's desired action
            this.action = (this.age % 1600) ? Utility.randi(0, 4) : this.action;
            switch (this.action) {
                case 0: // Left
                    this.force.x += -this.speed * 0.095;
                    break;
                case 1: // Right
                    this.force.x += this.speed * 0.095;
                    break;
                case 2: // Up
                    this.force.y += -this.speed * 0.095;
                    break;
                case 3: // Down
                    this.force.y += this.speed * 0.095;
                    break;
                // case 4: // Down
                //     this.force.y += this.speed * 0.95;
                //     break;
                // case 5: // Down
                //     this.force.y += this.speed * 0.95;
                //     break;
                // case 6: // Down
                //     this.force.y += this.speed * 0.95;
                //     break;
                // case 7: // Down
                //     this.force.y += this.speed * 0.95;
                //     break;
            }

            // Forward the agent by force
            this.position.vx = this.force.x;
            this.position.vy = this.force.y;
            this.position.advance(this.speed);
            this.direction = Utility.getDirection(this.position.direction);

            return this;
        }

        /**
         * Do work son
         * @param {World} world
         * @returns {Entity}
         */
        tick() {
            this.age += 1;
            this.move();

            return this;
        }

        /**
         * Perform the start of a drag
         *
         * @param {MouseEvent} event
         * @returns {Entity}
         */
        onDragStart(event) {
            this.data = event.data;
            this.interactionTarget = event.target;
            this.alpha = 0.5;
            this.dragging = true;

            return this;
        }

        /**
         * Perform the move of a drag
         *
         * @returns {Entity}
         */
        onDragMove() {
            if (this.dragging) {
                let newPosition = this.data.getLocalPosition(this.interactionTarget.parent);
                this.position.set(newPosition.x, newPosition.y);
            }

            return this;
        }

        /**
         * Perform the end of a drag
         *
         * @returns {Entity}
         */
        onDragEnd() {
            this.alpha = 1;
            this.dragging = false;
            let newPosition = this.data.getLocalPosition(this.interactionTarget.parent);
            this.position.set(newPosition.x, newPosition.y);

            // set the interaction data to null
            this.data = null;
            this.interactionTarget = null;

            return this;
        }

        /**
         * Perform the action for mouse down
         *
         * @returns {Entity}
         */
        onMouseDown() {
            this.isDown = true;
            this.alpha = 1;

            return this;
        }

        /**
         * Perform the action for mouse up
         *
         * @returns {Entity}
         */
        onMouseUp() {
            this.isDown = false;

            return this;
        }

        /**
         * Perform the action for mouse over
         *
         * @returns {Entity}
         */
        onMouseOver() {
            this.isOver = true;
            if (this.isDown) {
                return this;
            }

            return this;
        }

        /**
         * Perform the action for mouse out
         *
         * @returns {Entity}
         */
        onMouseOut() {
            this.isOver = false;
            if (this.isDown) {
                return this;
            }

            return this;
        }
    }

    global.Entity = Entity;

}(this));
