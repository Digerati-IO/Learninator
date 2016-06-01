(function (global) {
    "use strict";

    var Utility = global.Utility || {},
        CollisionDetector = global.CollisionDetector || {},
        Entity = global.Entity || {},
        EntityRLDQN = global.EntityRLDQN || {},
        FlotGraph = global.FlotGraph || {},
        Wall = global.Wall || {},
        Vec = global.Vec || {};

    class World {

        /**
         * The flags for what to display for 'cheats'
         * @typedef {Object} cheatsOpts
         * @property {boolean} id
         * @property {boolean} name
         * @property {boolean} direction
         * @property {boolean} gridLocation
         * @property {boolean} position
         * @property {boolean} walls
         */

        /**
         * Options for the World
         * @typedef {Object} worldOpts
         * @property {number} simSpeed - The speed of the simulation
         * @property {collisionOpts} collision - The collision definition
         * @property {cheatsOpts} cheats - The cheats definition
         * @property {number} numEntities - The number of Entities to spawn
         * @property {entityOpts} entityOpts - The Entity options to use for them
         * @property {number} numEntityAgents - The number of EntityAgents to spawn
         * @property {entityAgentOpts} entityAgentOpts - The EntityAgent options to use for them
         * @property {Grid} grid - The grid to use
         */

        /**
         * Options for the World renderer
         * @typedef {Object} renderOpts
         * @property {HTMLCanvasElement} view - the canvas to use as a view, optional
         * @property {boolean} transparent - If the render view is transparent, default false
         * @property {boolean} antialias - sets antialias (only applicable in chrome at the moment)
         * @property {boolean} preserveDrawingBuffer - enables drawing buffer preservation, enable this if you
         *      need to call toDataUrl on the webgl context
         * @property {number} resolution - the resolution of the renderer, retina would be 2
         * @property {boolean} noWebGL - prevents selection of WebGL renderer, even if such is present
         * @property {number} width - The width
         * @property {number} height - The height
         */

        /**
         * Make a World
         * @name World
         * @constructor
         *
         * @param {Array} agents
         * @param {Array} walls
         * @param {worldOpts} worldOpts
         * @param {renderOpts} renderOpts
         * @returns {World}
         */
        constructor(agents, walls, worldOpts, renderOpts) {
            this.rendererOpts = renderOpts || {
                    antialiasing: false,
                    autoResize: false,
                    resolution: window.devicePixelRatio,
                    resizable: false,
                    transparent: false,
                    noWebGL: true,
                    width: 600,
                    height: 600
                };
            this.options = worldOpts;
            this.width = this.rendererOpts.width;
            this.height = this.rendererOpts.height;
            this.resizable = this.rendererOpts.resizable;
            this.stage = new PIXI.Container();
            this.grid = Utility.getOpt(worldOpts, 'grid', false);
            this.maze = Utility.getOpt(worldOpts, 'maze', false);
            this.simSpeed = Utility.getOpt(worldOpts, 'simSpeed', 1);
            this.cheats = Utility.getOpt(worldOpts, 'cheats', {
                id: false,
                name: false,
                angle: false,
                bounds: false,
                direction: false,
                gridLocation: false,
                position: false
            });
            this.collision = Utility.getOpt(worldOpts, 'collision', {
                type: 'quad',
                maxChildren: 10,
                maxDepth: 30,
                cheats: {
                    bounds: this.cheats.bounds
                }
            });
            if (this.grid) {
                this.stage.addChild(this.grid.cellsContainer);
            }

            this.clock = 0;
            this.pause = false;

            this.renderer = PIXI.autoDetectRenderer(this.width, this.height, this.rendererOpts);
            this.renderer.backgroundColor = 0xFFFFFF;
            this.renderer.view.style.pos = "absolute";
            this.renderer.view.style.top = "0px";
            this.renderer.view.style.left = "0px";

            this.populationContainer = new PIXI.Container();
            this.population = new Map();

            this.agents = agents || [];
            this.entityAgents = [];
            this.numAgents = this.agents.length;
            this.numEntities = Utility.getOpt(worldOpts, 'numEntities', 5);
            this.numEntityAgents = Utility.getOpt(worldOpts, 'numEntityAgents', 0);
            this.entityOpts = Utility.getOpt(worldOpts, 'entityOpts', {});
            this.entityOpts.cheats = this.cheats;
            this.entityAgentOpts = Utility.getOpt(worldOpts, 'entityAgentOpts', {});
            this.entityAgentOpts.cheats = this.cheats;

            this.walls = walls;
            if (!this.walls) {
                this.walls.push(new Wall(new Vec(1, 1), new Vec(this.width - 1, 1), this.cheats, 'Top'));
                this.walls.push(new Wall(new Vec(this.width - 1, 1), new Vec(this.width - 1, this.height - 1), this.cheats, 'Right'));
                this.walls.push(new Wall(new Vec(1, this.height - 1), new Vec(this.width - 1, this.height - 1), this.cheats, 'Bottom'));
                this.walls.push(new Wall(new Vec(1, 1), new Vec(1, this.height - 1), this.cheats, 'Left'));
            }

            if (document.getElementById('flotreward')) {
                this.rewards = new FlotGraph(this.agents);
            }
            // Actually place the renderer onto the page for display
            document.body.querySelector('#game-container').appendChild(this.renderer.view);

            var animate = (timestamp) => {
                var timeSinceLast,
                    now = new Date().getTime() / 1000;
                if (!this.pause) {
                    timeSinceLast = now - this.lastTime;
                    this.lastTime = now;
                    this.tick(timeSinceLast);
                }
                this.renderer.render(this.stage);
                requestAnimationFrame(animate);
            };

            var resize = () => {
                // Determine which screen dimension is most constrained
                let ratio = Math.min(window.innerWidth / this.width, window.innerHeight / this.height);
                // Scale the view appropriately to fill that dimension
                this.stage.scale.x = this.stage.scale.y = ratio;
                // Update the renderer dimensions
                this.renderer.resize(Math.ceil(this.width * ratio), Math.ceil(this.height * ratio));
            };

            if (this.resizable) {
                // Listen for and adapt to changes to the screen size, e.g.,
                // user changing the window or rotating their device
                window.addEventListener("resize", resize);

                // Size the renderer to fill the screen
                resize();
            }

            // Walls
            this.addWalls();
            // Add the entities
            this.addEntities(this.numEntities);
            // Population of Agents that are considered 'smart' entities for the environment
            this.addEntityAgents();
            // Population of Agents for the environment
            this.addAgents();
            // Add the population container to the stage
            this.stage.addChild(this.populationContainer);

            CollisionDetector.apply(this, [this.collision]);

            this.lastTime = new Date().getTime() / 1000;
            requestAnimationFrame(animate);

            return this;
        }

        /**
         * Add the Agents
         * @returns {World}
         */
        addAgents() {
            // Add the agents
            for (let a = 0; a < this.numAgents; a++) {
                let agent = this.agents[a].shape || this.agents[a].sprite;
                if (this.agents[a].eyes !== undefined) {
                    for (let ei = 0; ei < this.agents[a].eyes.length; ei++) {
                        agent.addChild(this.agents[a].eyes[ei].shape);
                    }
                }
                if (this.agents[a].hexStyles !== undefined) {
                    this.agents[a].color = this.agents[a].hexStyles[this.agents[a].type];
                }
                this.populationContainer.addChild(agent);
                this.population.set(this.agents[a].id, this.agents[a]);
            }

            return this;
        }

        /**
         * Add some noms
         * @returns {World}
         */
        addEntityAgents() {
            let startXY,
                r = this.entityAgentOpts.radius;
            for (let k = 0; k < this.numEntityAgents; k++) {
                if (this.grid && this.grid.startCell !== undefined) {
                    let numb = Math.floor(Math.random() * this.grid.cells.length),
                        startCell = this.grid.cells[numb],
                        randAdd = Utility.Maths.randi(-7, 7);
                    startXY = new Vec(startCell.center.x + randAdd, startCell.center.y + randAdd);
                } else {
                    startXY = new Vec(
                        Utility.Maths.randi(r, this.width - r),
                        Utility.Maths.randi(r, this.height - r)
                    );
                }
                startXY.vx = Math.random() * 5 - 2.5;
                startXY.vy = Math.random() * 5 - 2.5;
                let entityAgent = new EntityRLDQN(startXY, this.entityAgentOpts),
                    entity = entityAgent.shape || entityAgent.sprite;
                for (let ei = 0; ei < entityAgent.eyes.length; ei++) {
                    entity.addChild(entityAgent.eyes[ei].shape);
                }
                this.entityAgents.push(entityAgent);
                this.populationContainer.addChild(entity);
                this.population.set(entityAgent.id, entityAgent);
            }

            return this;
        }

        /**
         * Add new entities
         * @parameter {number} number
         * @returns {World}
         */
        addEntities(number = 1) {
            let startXY,
                r = this.entityOpts.radius;

            // Populating the world
            for (let k = 0; k < number; k++) {
                if (this.grid && this.grid.startCell !== undefined) {
                    let numb = Math.floor(Math.random() * this.grid.cells.length),
                        startCell = this.grid.cells[numb],
                        randAdd = Utility.Maths.randi(-(this.grid.cellSize / 2 -r), this.grid.cellSize / 2 -r);
                    startXY = new Vec(startCell.center.x + randAdd, startCell.center.y + randAdd);
                } else {
                    startXY = new Vec(
                        Utility.Maths.randi(r, this.width - r),
                        Utility.Maths.randi(r, this.height - r)
                    );
                }
                startXY.vx = Utility.Maths.randf(-3, 3);
                startXY.vy = Utility.Maths.randf(-3, 3);
                let type = Utility.Maths.randi(1, 3),
                    entity = new Entity(type, startXY, this.entityOpts);

                this.populationContainer.addChild(entity.shape || entity.sprite);
                this.population.set(entity.id, entity);
            }

            return this;
        }

        /**
         * Add the Walls
         * @returns {World}
         */
        addWalls() {
            // Add the walls to the world
            this.walls.forEach((wall, id) => {
                this.populationContainer.addChild(wall.shape);
                this.population.set(wall.id, wall);
            });

            return this;
        }

        /**
         * Remove the entity from the world
         * @param {string} id
         * @returns {World}
         */
        deleteEntity(id) {
            if (this.population.has(id)) {
                let entity = this.population.get(id),
                    entityIdx = this.populationContainer.getChildIndex(entity.shape || entity.sprite);
                this.populationContainer.removeChildAt(entityIdx);
                this.population.delete(id);
            }
            return this;
        }

        /**
         * Tick the environment
         * @returns {World}
         */
        tick() {
            this.updatePopulation();

            let popCount = 0;
            for (let [id, entity] of this.population.entries()) {
                if (entity.type !== 0) {
                    // Check them for collisions
                    this.check(entity);
                    // Loop through the eyes and check the walls and nearby entities
                    for (let ae = 0, ne = entity.numEyes; ae < ne; ae++) {
                        this.check(entity.eyes[ae]);
                    }

                    // Tick them
                    entity.tick();

                    let top = this.height - (this.height - entity.radius),
                        bottom = this.height - entity.radius,
                        left = this.width - (this.width - entity.radius),
                        right = this.width - entity.radius;

                    // Tweak them
                    if (entity.position.x < left) {
                        entity.position.x = left;
                        entity.force.x = entity.speed * 0.95;
                    }

                    if (entity.position.x > right) {
                        entity.position.x = right;
                        entity.force.x = -entity.speed * 0.95;
                    }

                    if (entity.position.y < top) {
                        entity.position.y = top;
                        entity.force.y = entity.speed * 0.95;
                    }

                    if (entity.position.y > bottom) {
                        entity.position.y = bottom;
                        entity.force.y = -entity.speed * 0.95;
                    }

                    if (entity.useSprite) {
                        entity.sprite.position.set(entity.position.x, entity.position.y);
                    }
                    if (entity.cleanUp === true || ((entity.type === 2 || entity.type === 1) && entity.age > 5000)) {
                        this.deleteEntity(entity.id);
                    } else if (entity.type === 2 || entity.type === 1) {
                        popCount++;
                    }
                } else {
                    entity.draw();
                }
            }

            // If we have less then the number of Items allowed throw a random one in
            if (popCount < this.numEntities) {
                // this.addEntities(this.numEntities - popCount);
            }

            if (this.rewards) {
                this.rewards.graphRewards();
            }

            return this;
        }
    }
    global.World = World;

}(this));
