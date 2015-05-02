var Maze = Maze || {};

(function (global) {
	"use strict";

	/**
	 * A maze
	 * @param {HTMLCanvasElement} canvas
	 * @param {Object} options
	 * @returns {undefined}
	 */
	var Maze = function (options) {
		this.canvas = options.canvas;
		this.ctx = this.canvas.getContext("2d");

		this.width = this.canvas.width;
		this.height = this.canvas.height;
		this.horizCells = options.horizCells;
		this.vertCells = options.vertCells;
		this.vW = this.width / this.horizCells;
		this.vH = this.height / this.vertCells;
		this.cells = [];
		this.cellStack = [];
		this.path = [];

		this.graphOptions = {
			'width': this.horizCells,
			'height': this.vertCells
		};

		this.graph = new Graph(this.canvas, null, this.graphOptions);

		this.draw();
		this.solve();
	};

	/**
	 *
	 */
	Maze.prototype = {
		/**
		 * Add a Wall to the Maze
		 * @param {Vec} v1
		 * @param {Vec} v2
		 * @returns {undefined}
		 */
		addWall: function (v1, v2) {
			this.cells.push(new Wall(v1, v2));
		},
		/**
		 * Return the Cells
		 * @returns {Array}
		 */
		cells: function () {
			return this.cells;
		},
		/**
		 * Return the Graph's Cells
		 * @returns {Array}
		 */
		graphCells: function () {
			return this.graph.cells;
		},
		/**
		 * Draw it
		 * @returns {undefined}
		 */
		draw: function () {
			this.generate();
			this.drawBorders();
			this.drawMaze();
		},
		/**
		 * Draw the borders
		 * @returns {undefined}
		 */
		drawBorders: function () {
			this.addWall(new Vec(this.vW, 0), new Vec(this.width, 0));
			this.addWall(new Vec(this.width, 0), new Vec(this.width, this.height));
			this.addWall(new Vec(this.width - this.vW, this.height), new Vec(0, this.height));
			this.addWall(new Vec(0, this.height), new Vec(0, 0));
		},
		/**
		 * Draw the solution
		 * @returns {undefined}
		 */
		drawSolution: function () {
			var _this = this;
			var path = this.path;
			this.ctx.fillStyle = "rgba(0,165,0,.1)";
			this.ctx.strokeStyle = "rgb(0,0,0)";
			for (var i = 0; i < this.path.length; i++) {
				var V = path[ei];
				var vW = this.vW,
					vH = this.vH,
					vX = V.x,
					vY = V.y,
					// Get the cell X coords and multiply by the cell width
					x = _this.graph.cells[vX][vY].x * vW,
					// Get the cell Y coords and multiply by the cell height
					y = _this.graph.cells[vX][vY].y * vH;
				(function () {
					_this.ctx.fillRect(x, y, vW, vH);
				})();
			}
		},
		/**
		 * Draw the Maze
		 * @returns {undefined}
		 */
		drawMaze: function () {
			var graph = this.graph,
				drawnEdges = [];

			var edgeAlreadyDrawn = function (v1, v2) {
				return _.detect(drawnEdges, function (edge) {
					return _.include(edge, v1) && _.include(edge, v2);
				}) !== undefined;
			};

			for (var i = 0; i < graph.width; i++) {
				for (var j = 0; j < graph.height; j++) {
					var v = graph.cells[i][j],
						topV = graph.getVecAt(v.x, v.y - 1),
						leftV = graph.getVecAt(v.x - 1, v.y),
						rightV = graph.getVecAt(v.x + 1, v.y),
						bottomV = graph.getVecAt(v.x, v.y + 1);

					if (!edgeAlreadyDrawn(v, topV) && graph.areConnected(v, topV)) {
						var x1 = v.x * this.vW,
							y1 = v.y * this.vH,
							x2 = x1 + this.vW,
							y2 = y1;

						this.addWall(new Vec(x1, y1), new Vec(x2, y2));
						drawnEdges.push([v, topV]);
					}

					if (!edgeAlreadyDrawn(v, leftV) && graph.areConnected(v, leftV)) {
						var x2 = x1,
							y2 = y1 + this.vH;

						this.addWall(new Vec(x1, y1), new Vec(x2, y2));
						drawnEdges.push([v, leftV]);
					}

					if (!edgeAlreadyDrawn(v, rightV) && graph.areConnected(v, rightV)) {
						var x1 = (v.x * this.vW) + this.vW,
							y1 = v.y * this.vH,
							x2 = x1,
							y2 = y1 + this.vH;

						this.addWall(new Vec(x1, y1), new Vec(x2, y2));
						drawnEdges.push([v, rightV]);
					}

					if (!edgeAlreadyDrawn(v, bottomV) && graph.areConnected(v, bottomV)) {
						var x1 = v.x * this.vW,
							y1 = (v.y * this.vH) + this.vH,
							x2 = x1 + this.vW,
							y2 = y1;

						this.addWall(new Vec(x1, y1), new Vec(x2, y2));
						drawnEdges.push([v, bottomV]);
					}
				}
			}
		},
		/**
		 * Build the maze
		 * @returns {undefined}
		 */
		generate: function () {
			var initialCell = this.graph.getVecAt(1, 1);
			this.recurse(initialCell);
		},
		/**
		 * Recurse through a Cell's neighboors
		 * @param {Cell} cell
		 * @returns {undefined}
		 */
		recurse: function (cell) {
			cell.visit();
			var neighbors = this.graph.unvisitedNeighbors(cell);
			if (neighbors.length > 0) {
				var randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
				this.cellStack.push(cell);
				this.graph.removeEdgeBetween(cell, randomNeighbor);
				this.recurse(randomNeighbor);
			} else {
				var waitingCell = this.cellStack.pop();
				if (waitingCell) {
					this.recurse(waitingCell);
				}
			}
		},
		/**
		 * Solve the Maze
		 * @returns {undefined}
		 */
		solve: function () {
			var closedSet = [],
				// Top left cell
				startCell = this.graph.getVecAt(0, 0),
				// Bottom right cell
				targetCell = this.graph.getVecAt(this.graph.width - 1, this.graph.height - 1),
				openSet = [startCell],
				searchCell = startCell;

			while (openSet.length > 0) {
				var neighbors = this.graph.disconnectedNeighbors(searchCell);
				for (var i = 0; i < neighbors.length; i++) {
					var neighbor = neighbors[i];
					if (neighbor === targetCell) {
						neighbor.parent = searchCell;
						this.path = neighbor.pathToOrigin();
						openSet = [];
						return;
					}
					if (!_.include(closedSet, neighbor)) {
						if (!_.include(openSet, neighbor)) {
							openSet.push(neighbor);
							neighbor.parent = searchCell;
							neighbor.heuristic = neighbor.score() + this.graph.getVecDistance(neighbor, targetCell);
						}
					}
				}
				closedSet.push(searchCell);
				openSet.remove(_.indexOf(openSet, searchCell));
				searchCell = null;

				_.each(openSet, function (cell) {
					if (!searchCell) {
						searchCell = cell;
					} else if (searchCell.heuristic > cell.heuristic) {
						searchCell = cell;
					}
				});
			}
		}
	};

	global.Maze = Maze;

}(this));