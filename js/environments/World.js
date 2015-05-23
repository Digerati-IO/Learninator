var World = World || {};
var Agent = Agent || {};
var Interactions = Interactions || {};
var Utility = Utility || {};
var PIXI = PIXI || {};

(function (global) {
	"use strict";

	/**
	 * Make a World
	 * @param {Object} options
	 * @returns {World}
	 */
	var World = function (options) {
		this.canvas = options.canvas;
		this.ctx = this.canvas.getContext("2d");
		this.width = this.canvas.width;
		this.height = this.canvas.height;

		this.maze = options.maze;
		this.graph = this.maze.graph;
		this.grid = this.maze.graph.cells;

		this.vW = this.width / this.graph.width;
		this.vH = this.height / this.graph.height;

		this.clock = 0;

		/**
		* 1s = 1000ms (remember that setInterval and setTimeout run on milliseconds)
		* 1000ms / 60(fps) = 16.7ms (we'll round this to 17)
		*/
		this.fps = 60;
		this.interval = 1000 / this.fps;
		this.numItems = 60;
		this.entities = [];
		this.types = ['Wall', 'Nom', 'Gnar'];

		// create a renderer instance.
		this.renderer = PIXI.autoDetectRenderer(this.width, this.height, {view:this.canvas}, true);
		this.renderer.backgroundColor = 0xFFFFFF;
		// add the renderer view element to the DOM
		document.body.appendChild(this.renderer.view);
		// create an new instance of a pixi stage
		this.stage = new PIXI.Container();

		// When set to true, the canvas will redraw everything
		this.pause = false;

		this.walls = options.walls || [];
		this.agents = options.agents || [];
		this.populate();

		var _this = this;

		for (var w = 0; w < this.walls.length; w++) {
			this.stage.addChild(this.walls[w].shape);
		}

		for (var a = 0; a < this.agents.length; a++) {
			this.stage.addChild(this.agents[a].sprite);
			for (var ei = 0; ei < this.agents[a].eyes.length; ei++) {
				this.stage.addChild(this.agents[a].eyes[ei].shape);
			}
		}

		for (var e = 0; e < this.entities.length; e++) {
			this.stage.addChild(this.entities[e].sprite);
		}

		requestAnimationFrame(animate);
		function animate() {
			_this.tick();
			// render the stage
			_this.renderer.render(_this.stage);
			requestAnimationFrame(animate);
		}
	};

	/**
	 * World
	 * @type World
	 */
	World.prototype = {
		/**
		 * Add an item to the world canvas and set it to redraw
		 * @param {Item||Agent} entity
		 * @returns {undefined}
		 */
		addEntity: function (entity) {
			if (entity.type !== 0) {
				Utility.getGridLocation(entity, this.grid, this.vW, this.vH);
				this.grid[entity.gridLocation.x][entity.gridLocation.y].population.push(entity.id);
			}
			this.stage.addChild(entity.sprite);
			this.entities.push(entity);
			this.redraw = true;
		},
		/**
		 * Randomly create an entity at the Vec
		 * @param {Vec} v
		 * @returns {undefined}
		 */
		addRandEntity: function(v) {
			this.addEntity(new Item(Utility.randi(1, 3), v, 20, 20, 10));
		},
		/**
		 * Add an item to the world canvas and set it to redraw
		 * @param {Item||Agent} entity
		 * @returns {undefined}
		 */
		deleteEntity: function (entity) {
			if (entity.type !== 0) {
				var x = entity.gridLocation.x,
					y = entity.gridLocation.y,
					index = this.grid[x][y].population.indexOf(entity.id);
				if (index > -1) {
					this.grid[x][y].population.splice(index, 1);
					var idx = this.entities.findIndex(Utility.getId, entity.id);
					this.entities.splice(idx, 1);
					this.stage.removeChild(entity.sprite);
				}
			}
		},
		/**
		 * Tick the environment
		 */
		tick: function () {
			this.clock++;

			// Tick ALL OF teh items!
			this.redraw = true;

			var agentCount = this.agents.length;
			for (var i = 0; i < agentCount; i++) {
				var agent = this.agents[i];
				Utility.getGridLocation(agent, this.grid, this.vW, this.vH);
				agent.tick(this.grid, this.walls, this.entities, this.width, this.height);
				var digestedCount = agent.digested.length;
				for (var j = 0; j < digestedCount; j++) {
					var entity = agent.digested[j];
					this.deleteEntity(entity);
				}
			}

			var entityCount = this.entities.length;
			for (var e = 0; e < entityCount; e++) {
				var entity = this.entities[i];
				entity.age += 1;

				if (entity.age > 10000 && this.clock % 100 === 0 && Utility.randf(0, 1) < 0.1) {
					this.deleteEntity(entity);
				}
			}

			// If we have less then the number of items allowed throw a random one in
			if (entityCount < this.numItems && this.clock % 10 === 0 && Utility.randf(0, 1) < 0.25) {
				var x = Utility.randf(10, this.width - 10),
					y = Utility.randf(10, this.height - 10);
				this.addRandEntity(new Vec(x, y));
			}

			for (var i = 0; i < agentCount; i++) {
				var agent = this.agents[i];
				// Throw some points on a Graph
				if (this.clock % 100 === 0 && agent.pts.length !== 0) {
					this.rewardGraph.addPoint(this.clock / 100, i, agent.pts);
					this.rewardGraph.drawPoints();
					// Clear them up since we've drawn them
					agent.pts = [];
				}
			}
		},
		/**
		 * Populate the World with Items
		 * @returns {undefined}
		 */
		populate: function () {
			for (var k = 0; k < this.numItems; k++) {
				var x = Utility.randf(10, this.width - 10),
					y = Utility.randf(10, this.height - 10);
				this.addRandEntity(new Vec(x, y));
			}
		}
	};

	global.World = World;

}(this));
