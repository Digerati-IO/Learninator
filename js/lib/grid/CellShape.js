/**
 * Original code borrowed from https://github.com/felipecsl/random-maze-generator
 *
 */
(function (global) {
    "use strict";

    class CellShape {
        /**
         * Create a CellShape
         * @name CellShape
         * @constructor
         *
         * @param {Array} corners
         * @param {boolean} cheats
         * @returns {CellShape}
         */
        constructor(corners, cheats = false) {
            this.corners = corners;
            this.shape = new PIXI.Graphics();
            this.shape.interactive = true;
            this.shape.alpha = 0.09;
            this.shape.color = 0xFFFFFF;
            this.shape
                .on('mousedown', (event) => {
                    this.data = event.data;
                    this.color = 0x00FF00;
                })
                .on('mouseup', (event) => {
                    this.color = 0xFFFFFF;
                })
                .on('mouseover', (event) => {
                    this.color = 0xFF0000;
                })
                .on('mouseout', (event) => {
                    this.color = 0xFFFFFF;
                });
            //this.shape.entity = self;

            return this;
        }

        draw() {
            this.shape.clear();
            this.shape.lineStyle(1, 0x000000);
            this.shape.beginFill(this.color);
            this.shape.moveTo(this.corners[0].x, this.corners[0].y);
            this.shape.lineTo(this.corners[1].x, this.corners[1].y);
            this.shape.lineTo(this.corners[2].x, this.corners[2].y);
            this.shape.lineTo(this.corners[3].x, this.corners[3].y);
            this.shape.lineTo(this.corners[0].x, this.corners[0].y);
            this.shape.endFill();

            if (this.cheatOverlay !== undefined) {
                this.shape.removeChild(this.cheatOverlay);
            }
            this.cheatOverlay = new PIXI.Container();

            let txtOpts = {font: "10px Arial", fill: "#000000", align: "center"},
                posText = new PIXI.Text(this.toString(), txtOpts);
            posText.position.set(this.corners[0].x + this.width / 2, this.corners[0].y + this.height / 2 + 13);
            this.cheatOverlay.addChild(posText);

            this.shape.addChild(this.cheatOverlay);

            return this;
        }
    }

    global.CellShape = CellShape;

}(this));
