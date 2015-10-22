/**
 *
 * @type {{Utility}}
 * @name Utility
 */
var Utility = Utility || {};

(function (global) {
    "use strict";

    // Random number utilities
    var retV = false,
        vVal = 0.0;

    Utility.rgbToHex = function (R, G, B) {
        return '0x' + Utility.toHex(R) + Utility.toHex(G) + Utility.toHex(B);
    };

    Utility.toHex = function (n) {
        n = parseInt(n, 10);
        if (isNaN(n)) {
            return '00';
        }
        n = Math.max(0, Math.min(n, 255));
        return '0123456789ABCDEF'.charAt((n - n % 16) / 16) + '0123456789ABCDEF'.charAt(n % 16);
    };

    Utility.hexToR = function (h) {
        return parseInt(h.substring(0, 2), 16);
    };

    Utility.hexToG = function (h) {
        return parseInt(h.substring(2, 4), 16);
    };

    Utility.hexToB = function (h) {
        return parseInt(h.substring(4, 6), 16);
    };

    /**
     * Utility fun
     * @param condition
     * @param message
     */
    Utility.assert = function (condition, message) {
        // from http://stackoverflow.com/questions/15313418/javascript-assert
        if (!condition) {
            message = message || "Assertion failed";
            if (Error !== undefined) {
                throw new Error(message);
            }
            throw message; // Fallback
        }
    };

    /**
     * Stringify an object including it's functions if it has any
     * @param {Object} obj
     */
    Utility.stringify = function (obj) {
        return JSON.stringify(obj, function (key, value) {
            return (typeof value === 'function') ? value.toString() : value;
        });
    };

    /**
     * Parse an object that has been stringified, and rebuild it's functions
     * @param {String} str
     */
    Utility.parse = function (str) {
        return JSON.parse(str, function (key, value) {
            if (typeof value !== 'string') {
                return value;
            }
            return (value.substring(0, 8) === 'function') ? eval('(' + value + ')') : value;
        });
    };

    /**
     * Syntactic sugar function for getting default parameter values
     * @param {Object} opt
     * @param {String} fieldName
     * @param {Mixed} defaultValue
     * @returns {*}
     */
    Utility.getOpt = function (opt, fieldName, defaultValue) {
        if (typeof opt === 'undefined') {
            return defaultValue;
        }
        return (typeof opt[fieldName] !== 'undefined') ? opt[fieldName] : defaultValue;
    };

    /**
     * Gaussian random number
     * @returns {Number}
     */
    Utility.gaussRandom = function () {
        if (retV) {
            retV = false;

            return vVal;
        }

        var u = 2 * Math.random() - 1,
            v = 2 * Math.random() - 1,
            r = u * u + v * v,
            c = Math.sqrt(-2 * Math.log(r) / r);
        if (r === 0 || r > 1) {
            return Utility.gaussRandom();
        }

        vVal = v * c; // cache this
        retV = true;

        return u * c;
    };

    /**
     * Return a random Float within the range of a-b
     * @param {Float} lo
     * @param {Float} hi
     * @returns {Number}
     */
    Utility.randf = function (lo, hi) {
        return Math.random() * (hi - lo) + lo;
    };

    /**
     * Return a random Integer within the range of a-b
     * @param {Number} lo
     * @param {Number} hi
     * @returns {Number}
     */
    Utility.randi = function (lo, hi) {
        return Math.floor(this.randf(lo, hi));
    };

    /**
     * Return a random Number
     * @param {Float} mu
     * @param {Float} std
     * @returns {Number}
     */
    Utility.randn = function (mu, std) {
        return mu + Utility.gaussRandom() * std;
    };

    /**
     * A helper function returns array of zeros of length n
     * and uses typed arrays if available
     * @param {Number} n
     * @returns {Float64Array}
     */
    Utility.zeros = function (n) {
        if (typeof n === 'undefined' || isNaN(n)) {
            return [];
        }
        if (typeof ArrayBuffer === 'undefined') {
            // lacking browser support
            var arr = new Array(n);
            for (let i = 0; i < n; i++) {
                arr[i] = 0;
            }
            return arr;
        } else {
            return new Float64Array(n);
        }
    };

    /**
     * Find an object in the array via id attribute
     *
     * @param {Array} ar
     * @param {String} id
     * @returns {undefined}
     */
    Utility.findObject = function (ar, id) {
        ar.map(function (el) {
            return el.id;
        }).indexOf(id);
    };

    /**
     * Get the object with the matching id property
     *
     * @param element
     * @param index
     * @param array
     * @returns {boolean}
     */
    Utility.getId = function (element, index, array) {
        if (element.id === this) {
            return true;
        }
        return false;
    };

    /**
     * Load JSON
     * @param file
     * @param callback
     */
    Utility.loadJSON = function (file, callback) {
        var xObj = new XMLHttpRequest();
        xObj.overrideMimeType("application/json");
        xObj.open('GET', file, true);
        xObj.onreadystatechange = function () {
            if (xObj.readyState === 4 && xObj.status === "200") {
                callback(xObj.responseText);
            }
        };
        xObj.send(null);
    };

    /**
     * Calculate the direction.
     * @param angle
     * @returns {string}
     */
    Utility.getDirection = function (angle) {
        var directions = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'],
            octant = Math.round(8 * angle / (2 * Math.PI) + 8) % 8;
        return directions[octant];
    };

    /**
     * Returns string representation of float but truncated to length of d digits
     * @param {Number} x Float
     * @param {Number} d Decimals
     * @returns {String}
     */
    Utility.flt2str = function (x, d) {
        d = (typeof(d) === undefined) ? 5 : d;
        var dd = 1.0 * Math.pow(10, d);

        return '' + Math.floor(x * dd) / dd;
    };

    /**
     * Find the area of a triangle
     * @param {Vec} v1
     * @param {Vec} v2
     * @param {Vec} v3
     * @returns {Number}
     */
    Utility.area = function (v1, v2, v3) {
        return Math.abs((v1.x * (v2.y - v3.y) + v2.x * (v3.y - v1.y) + v3.x * (v1.y - v2.y)) / 2.0);
    };

    /**
     * Do stuff
     * @returns {Number}
     */
    Utility.S4 = function () {
        return (((1 + Math.random()) * 0x10000) || 0).toString(16).substring(1);
    };

    /**
     * Generate a UUID
     * @returns {String}
     */
    Utility.guid = function () {
        return (this.S4() + this.S4() + "-" + this.S4() + "-4" + this.S4().substr(0, 3) + "-" + this.S4() + "-" + this.S4() + this.S4() + this.S4()).toLowerCase();
    };

    global.Utility = Utility;

}(this));