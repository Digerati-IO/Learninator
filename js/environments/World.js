/**
 * The flags for what to display for 'cheats'
 * Show the QuadTree overlay, show the grid overlay, show the wall's numbers
 * @typedef {Object} cheatsOpts
 * @property {boolean} quad - Show the Quadtree overlay
 * @property {boolean} grid - Show the Grid overlay
 * @property {boolean} walls - Show the Wall numbers
 */

/**
 * Options for the World that define the width/height
 * @typedef {Object} worldOpts
 * @property {number} simSpeed - The speed of the simulation
 * @property {cdOpts} collision - The collision definition
 * @property {cheatsOpts} cheats - The cheats definition
 */

/**
 * Options for the World renderer
 * @typedef {Object} renderOpts
 * @property [view] {HTMLCanvasElement} the canvas to use as a view, optional
 * @property [transparent=false] {boolean} If the render view is transparent, default false
 * @property [antialias=false] {boolean} sets antialias (only applicable in chrome at the moment)
 * @property [preserveDrawingBuffer=false] {boolean} enables drawing buffer preservation, enable this if you
 *      need to call toDataUrl on the webgl context
 * @property [resolution=1] {number} the resolution of the renderer, retina would be 2
 * @property [noWebGL=false] {boolean} prevents selection of WebGL renderer, even if such is present
 * @property {number} width - The width
 * @property {number} height - The height
 */

(function (global) {
    "use strict";

    class World {
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
        constructor(agents = [], walls, worldOpts, renderOpts) {
            var self = this;
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

            this.width = this.rendererOpts.width;
            this.height = this.rendererOpts.height;
            this.resizable = this.rendererOpts.resizable;

            this.clock = 0;
            this.pause = false;

            // The speed to run the simulation at
            this.simSpeed = Utility.getOpt(worldOpts, 'simSpeed', 1);

            // The collision detection type
            this.collision = Utility.getOpt(worldOpts, 'collision', {
                type: 'quad',
                maxChildren: 10,
                maxDepth: 20
            });

            // The cheats to display
            this.cheats = Utility.getOpt(worldOpts, 'cheats', {
                quad: false,
                grid: false,
                walls: false
            });

            // Walls if they were sent or 4 if not
            this.walls = walls || [
                new Wall(new Vec(1, 1), new Vec(this.width, 1), this.cheats.walls),
                new Wall(new Vec(this.width, 1), new Vec(this.width, this.height), this.cheats.walls),
                new Wall(new Vec(this.width, this.height), new Vec(1, this.height), this.cheats.walls),
                new Wall(new Vec(1, this.height), new Vec(1, 1), this.cheats.walls)
            ];

            // Get agents
            this.agents = agents;
            this.entityAgents = [];

            // Number of agents
            this.numAgents = this.agents.length;

            // Entity options
            this.numEntities = Utility.getOpt(worldOpts, 'numEntities', 5);
            this.entityOpts = Utility.getOpt(worldOpts, 'entityOpts', {
                radius: 10,
                collision: true,
                interactive: false,
                useSprite: false,
                movingEntities: false,
                cheats: {
                    gridLocation: false,
                    position: false,
                    name: false,
                    id: false
                }
            });

            // Entity Agent options
            this.numEntityAgents = Utility.getOpt(worldOpts, 'numEntityAgents', 0);
            this.entityAgentOpts = Utility.getOpt(worldOpts, 'entityAgentOpts', {
                radius: 10,
                collision: true,
                interactive: false,
                useSprite: false,
                movingEntities: false,
                cheats: {
                    gridLocation: false,
                    position: false,
                    name: false,
                    id: false
                }
            });

            function resize() {
                // Determine which screen dimension is most constrained
                let ratio = Math.min(window.innerWidth / self.width, window.innerHeight / self.height);
                // Scale the view appropriately to fill that dimension
                self.stage.scale.x = self.stage.scale.y = ratio;
                // Update the renderer dimensions
                self.renderer.resize(Math.ceil(self.width * ratio), Math.ceil(self.height * ratio));
            }

            // Create the canvas in which the game will show, and a
            // generic container for all the graphical objects
            this.renderer = PIXI.autoDetectRenderer(this.width, this.height, this.rendererOpts);
            //this.renderer = PIXI.CanvasRenderer(this.width, this.height, this.rendererOpts);
            this.renderer.backgroundColor = 0xFFFFFF;
            // Round the pixels
            //this.renderer.roundPixels = true;

            // Put the renderer on screen in the corner
            this.renderer.view.style.pos = "absolute";
            this.renderer.view.style.top = "0px";
            this.renderer.view.style.left = "0px";

            // The stage is essentially a display list of all game objects
            // for Pixi to render; it's used in resize(), so it must exist
            this.stage = new PIXI.Container();

            // Actually place the renderer onto the page for display
            document.body.querySelector('.game-container').appendChild(this.renderer.view);

            if (this.resizable) {
                // Listen for and adapt to changes to the screen size, e.g.,
                // user changing the window or rotating their device
                window.addEventListener("resize", resize);

                // Size the renderer to fill the screen
                resize();
            }
            this.populate();

            this.grid = Utility.getOpt(worldOpts, 'grid', false);
            if (this.grid) {
                this.cellsContainer = this.grid.getGrid();
                this.stage.addChild(this.cellsContainer);
            }

            if (document.getElementById('flotreward')) {
                this.rewards = new FlotGraph(this.agents);
            }

            function animate() {
                if (!self.pause) {
                    let ticker = 0;
                    switch (parseFloat(self.simSpeed)) {
                        case 1:
                            ticker = 1;
                            break;
                        case 2:
                            ticker = 30;
                            break;
                        case 3:
                            ticker = 60;
                            break;
                    }
                    for (let k = 0; k < ticker; k++) {
                        self.tick();
                    }
                }
                self.renderer.render(self.stage);
                requestAnimationFrame(animate);
            }

            CollisionDetector.apply(this, [this.collision]);

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
                for (let ei = 0; ei < this.agents[a].eyes.length; ei++) {
                    agent.addChild(this.agents[a].eyes[ei].shape);
                }
                this.agents[a].color = this.agents[a].hexStyles[this.agents[a].type];

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
            for (let k = 0; k < this.numEntityAgents; k++) {
                let x = Utility.randi(5, this.width - 10),
                    y = Utility.randi(5, this.height - 10),
                    vx = Math.random() * 5 - 2.5,
                    vy = Math.random() * 5 - 2.5,
                    entityAgent = new EntityRLDQN(new Vec(x, y, vx, vy), this.entityAgentOpts),
                    entity = entityAgent.shape || entityAgent.sprite;
                entityAgent.enemy = this.agents[k];
                entityAgent.target = (k === 0) ? this.agents[k + 1] : this.agents[k - 1];
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
        addEntities(number) {
            if (number === undefined) {
                number = 1;
            }
            // Populating the world
            for (let k = 0; k < number; k++) {
                let type = Utility.randi(1, 3),
                    x = Utility.randi(2, this.width - 2),
                    y = Utility.randi(2, this.height - 2),
                    vx = Utility.randf(-3, 3),
                    vy = Utility.randf(-3, 3),
                    entity = new Entity(type, new Vec(x, y, vx, vy), this.entityOpts);

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
            let wallsContainer = new PIXI.Container()
            this.walls.forEach((wall, id) => {
                wallsContainer.addChild(wall.shape);
                if (id > 3) {
                    this.population.set(wall.id, wall);
                }
            });
            this.populationContainer.addChild(wallsContainer);

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
         * Draws the world
         * @returns {World}
         */
        draw() {
            for (let [id, entity] of this.population.entries()) {
                if (entity.type !== 0) {
                    entity.draw();
                }
            }

            if (this.rewards) {
                this.rewards.graphRewards();
            }

            return this;
        }

        /**
         * Set up the population
         * @returns {World}
         */
        populate() {
            this.populationContainer = new PIXI.Container();
            this.population = new Map();

            // Walls
            this.addWalls();

            // Population of Agents for the environment
            this.addAgents();

            // Population of Agents that are considered 'smart' entities for the environment
            this.addEntityAgents();

            // Add the entities
            this.addEntities(this.numEntities);

            this.stage.addChild(this.populationContainer);

            return this;
        }

        /**
         * Set up the collision detection
         * @param {Object} collision
         * @returns {World}
         */
        setCollisionDetection(collision) {
            CollisionDetector.apply(this, [collision]);

            return this;
        }

        /**
         * Tick the environment
         * @returns {World}
         */
        tick() {
            this.updatePopulation();
            this.clock++;

            for (let [id, entity] of this.population.entries()) {
                if (entity.type !== 0) {
                    entity.tick(this);
                }
            }

            let popCount = 0;
            for (let [id, entity] of this.population.entries()) {
                if (entity.cleanUp === true || ((entity.type === 2 || entity.type === 1) && entity.age > 5000)) {
                    this.deleteEntity(entity.id);
                } else if (entity.type === 2 || entity.type === 1) {
                    popCount++;
                }
            }

            // If we have less then the number of Items allowed throw a random one in
            if (popCount < this.numEntities) {
                this.addEntities(this.numEntities - popCount);
            }

            this.draw();

            return this;
        }
    }

    global.World = World;

}(this));
