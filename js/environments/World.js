var World = World || {};
var Interactions = Interactions || {};
var Utility = Utility || {};

(function (global) {
	"use strict";

	/**
	 * Make a World
	 * @param {HTMLCanvasElement} canvas
	 * @param {Array} walls
	 * @param {Agent} agents
	 * @returns {World}
	 */
	var World = function (canvas, walls, agents, items) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.width = canvas.width;
		this.height = canvas.height;

		// An attempt to hold all the entities in this world
		this.entities = [];

		this.randf = function(a, b) { return Math.random()*(b-a)+a; };
		this.randi = function(a, b) { return Math.floor(Math.random()*(b-a)+a); };

		this.clock = 0;
		this.simSpeed = 2;
		this.interval = 60;
		this.numItems = 20;
		this.entities = [];

		this.populate();

		this.addWalls(walls || []);
		this.addAgents(agents || []);
		this.addEntities(this.walls);
		this.addEntities(this.agents);

		// This complicates things a little but but fixes mouse co-ordinate problems
		// when there's a border or padding. See getMouse for more detail
		var stylePaddingLeft, stylePaddingTop, styleBorderLeft, styleBorderTop;
		if (document.defaultView && document.defaultView.getComputedStyle) {
			this.stylePaddingLeft = parseInt(document.defaultView.getComputedStyle(this.canvas, null)['paddingLeft'], 10) || 0;
			this.stylePaddingTop = parseInt(document.defaultView.getComputedStyle(this.canvas, null)['paddingTop'], 10) || 0;
			this.styleBorderLeft = parseInt(document.defaultView.getComputedStyle(this.canvas, null)['borderLeftWidth'], 10) || 0;
			this.styleBorderTop = parseInt(document.defaultView.getComputedStyle(this.canvas, null)['borderTopWidth'], 10) || 0;
		}

		// Some pages have fixed-position bars at the top or left of the page
		// They will mess up mouse coordinates and this fixes that
		var html = document.body.parentNode;
		this.htmlTop = html.offsetTop;
		this.htmlLeft = html.offsetLeft;

		// When set to false, the canvas will redraw everything
		this.valid = false;

		// Currently selected object. In the future an array for multiple selection
		this.selection = null;

		// **** Options! ****
		this.selectionColor = '#CC0000';
		this.selectionWidth = 1;

		this.types = ['Wall', 'Nom', 'Gnar', 'Agent'];

		this.rewardGraph = {};

		var self = this;

		// Apply the Interactions class to the world
		Interactions.apply(this, [canvas]);

		setInterval(function () {
			self.tick();
			if (!self.valid || self.clock % 50 === 0) {
				self.draw();
			}
		}, self.interval);
	};

	/**
	 * World
	 * @type World
	 */
	World.prototype = {
		/**
		 * Add an agent to the world canvas and set it to redraw
		 * @param {Array} agents
		 * @returns {undefined}
		 */
		addAgents: function (agents) {
			this.agents = this.agents || agents;
			this.valid = false;
		},
		/**
		 * Add an item to the world canvas and set it to redraw
		 * @param {Array} entities
		 * @returns {undefined}
		 */
		addEntities: function (entities) {
			var oE = this.entities,
				nE = entities;
			this.entities = oE.concat(nE);
			this.valid = false;
		},
		/**
		 * Add an item to the world canvas and set it to redraw
		 * @param {Item||Agent} entity
		 * @returns {undefined}
		 */
		addEntity: function (entity) {
			this.entities.push(entity);
			this.valid = false;
		},
		/**
		 * Randomly create an antity at the Vec
		 * @param {Vec} v
		 * @returns {undefined}
		 */
		addRandEntity: function(v) {
			this.addEntity(new Item(this.randi(1, 3), v, 0, 0, this.randi(7, 11)));
		},
		/**
		 * Add walls
		 * @param {Array} walls
		 * @returns {undefined}
		 */
		addWalls: function (walls) {
			this.walls = this.walls || walls;
			this.valid = false;
		},
		/**
		 * Clear the canvas
		 * @returns {undefined}
		 */
		clear: function () {
			this.ctx.clearRect(0, 0, this.width, this.height);
		},
		/**
		 * A helper function to get check for colliding walls/items
		 * @param {Vec} v1
		 * @param {Vec} v2
		 */
		collisionCheck: function (v1, v2, checkWalls, checkItems) {
			var minRes = false;

			// Collide with walls
			if (checkWalls) {
				for (var i = 0, wall; wall = this.walls[i++];) {
					minRes = wall.collisionCheck(minRes, v1, v2);
				}
			}

			// Collide with items
			if (checkItems) {
				for (var i = 0, entity; entity = this.entities[i++];) {
					minRes = entity.collisionCheck(minRes, v1, v2);
				}
			}

			return minRes;
		},
		contains: function () {

		},
		/**
		 * Draw the world
		 * @returns {undefined}
		 */
		draw: function () {
			this.clear();

			// Draw the population of the world
			for (var i = 0, entity; entity = this.entities[i++];) {
				entity.draw(this.ctx);
			}
		},
		/**
		 * Set the speed of the world
		 * @param {type} speed
		 * @returns {undefined}
		 */
		go: function (speed) {
			clearInterval(this.interval);
			this.valid = false;
			switch(speed) {
				case 'min':
					this.interval = setInterval(this.tick(), 200);
					this.simSpeed = 0;
					break;
				case 'mid':
					this.interval = setInterval(this.tick(), 30);
					this.simSpeed = 1;
					break;
				case 'max':
					this.interval = setInterval(this.tick(), 0);
					this.simSpeed = 2;
					break;
				case 'max+':
					this.interval = setInterval(this.tick(), 0);
					this.valid = true;
					this.simSpeed = 3;
					break;
			}
		},
		/**
		 * Tick the environment
		 */
		tick: function () {
			this.clock++;

			// Fix input to all agents based on environment and process their eyes
			for (var i = 0, agent; agent = this.agents[i++];) {
				agent.tick(this);
			}

			// Tick ALL OF teh items!
			this.valid = false;
			for (var i = 0, entity; entity = this.entities[i++];) {
				if (entity.type == 1 || entity.type == 2) {
					entity.age += 1;
					// Did the agent find teh noms?
					for (var j = 0, agent; agent = this.agents[j++];) {
						entity.cleanUp = agent.eat(this, entity);
						if (entity.cleanUp) {
							this.valid = true;
							break;
						}
					}

					if (entity.age > 5000 && this.clock % 100 === 0 && this.randf(0, 1) < 0.1) {
						// Keell it, it has been around way too long
						entity.cleanUp = true;
						this.valid = true;
					}
				}
			}

			// Drop old the items
			if (this.valid) {
				var nt = [];
				for (var i = 0, entity; entity = this.entities[i++];) {
					if (entity.type == 1 || entity.type == 2) {
						if (!entity.cleanUp)
							nt.push(entity);
					} else {
						nt.push(entity);
					}
				}
				// Swap new list
				this.entities = nt;
			}

			// If we have less then the number of items allowed throw a random one in
			if (this.entities.length < this.numItems && this.clock % 10 === 0 && this.randf(0, 1) < 0.25) {
				var x = this.randf(20, this.width - 20),
					y = this.randf(20, this.height - 20);
				this.addRandEntity(new Vec(x, y));
			}

			// This is where the agents learns based on the feedback of their
			// actions on the environment
			var pts = [];
			for (var i = 0, agent; agent = this.agents[i++];) {
				agent.backward();
				pts.push(agent.brain.avgRewardWindow.getAverage());
			}

			// Throw some points on a Graph
			if (this.clock % 200 === 0) {
				this.rewardGraph.addPoint(this.clock / 200, pts);
				this.rewardGraph.drawPoints();
			}
		},
		/**
		 * Handle the right click on the world
		 * @param {Object} mouse
		 * @returns {undefined}
		 */
		onRightClick: function (mouse) {

		},
		/**
		 * Handle the double click on the world
		 * @param {Object} mouse
		 * @returns {undefined}
		 */
		onDoubleClick: function (mouse) {
			this.addRandEntity(new Vec(mouse.pos.x, mouse.pos.y));
		},
		/**
		 * Populate the World with Items
		 * @returns {undefined}
		 */
		populate: function () {
			for (var k = 0; k < this.numItems; k++) {
				var x = this.randf(20, this.width - 20),
					y = this.randf(20, this.height - 20);
				this.addRandEntity(new Vec(x, y));
			}
		}
	};

	global.World = World;

}(this));
