var PerspectiveLayer = require('./engine/perspective-layer');
var CollisionLayer = require('./engine/collision-layer');
var ImageLayer = require('./engine/image-layer');

var Animation = require('./engine/animation');
var config = require('./config');
var Camera = require('./engine/camera');

var Entities = require('./entities/entities');

var p = require('./engine/physics');

var Input = require('./engine/input');
var Keys = require('./engine/keys');

var Level = Class.extend({
    width: 1,
    height: 1,
    tilewidth: 16,
    tileheight: 16,

    layers: [],

    entities: [],

    realwidth: 16,
    realheight: 16,

    player: null,
    camera: null,

    spawn: {
        x: 0,
        y: 0
    },

    checkpoint: null,

    activemorph: 0,
    morphs: null,
    morphing: false,
    morphSubject: null,

    init: function(data) {
        p.resetWorld();

        this.layers = [];
        this.entities = [];

        this.initUI(data.morphs);

        this.spawn = {
            x: 0,
            y: 0
        };

        this.height = data.height;
        this.width = data.width;
        this.tilewidth = data.tilewidth;
        this.tileheight = data.tileheight;

        this.realheight = this.tileheight * this.height;
        this.realwidth = this.tilewidth * this.width;

        this.initLayers(data.layers);


        this.player = new Entities.Player(this.spawn.x, this.spawn.y);
        this.entities.push(this.player);

        this.camera = new Camera(config.display.width / 2, config.display.height / 2, 0.2);
        this.camera.trap.size.x = config.display.width / 10;
        this.camera.trap.size.y = config.display.height / 5;
        this.camera.min.x = -config.perspective.pWidth;
        this.camera.min.y = -config.perspective.pHeight;
        this.camera.max.x = this.realwidth;
        this.camera.max.y = this.realheight;
        this.camera.set(this.player);

    },


    initUI: function(morphs) {
        var i = 1;
        var parent = $('#morphs > div');
        parent.html('');
        for (i; i < 7; i++) {
            parent.append('<div id="' + i + '">x<span>0</span><figure></figure><div class="key">' + i + '</div></div>');
        }

        this.morphs = [];

        i = 1;
        for (var m in morphs) {
            if (i > 6) break;

            var mo = Object.$get(Entities, m);
            if (!mo) continue;
            var n = morphs[m];

            var el = '#morphs > div #' + i;
            $(el + ' span').text(n);
            $(el + ' figure').css('background-position', "-" + mo.bgpos.x + "px " + "-" + mo.bgpos.y + "px");
            $(el).data('info', mo.info);

            this.morphs.push({
                type: m,
                count: n,
                info: mo.info
            });

            i++;
        }

        this.setActiveMorph(0);
    },

    setActiveMorph: function(i) {
        this.activemorph = i;
        $('#morphs > div div').removeClass('active');
        $('#morphs > div #' + (i + 1)).addClass('active');
        var info = this.morphs[i];
        info = (info && info.count > 0) ? info.info : 'Empty';
        $('#morphs > span').text(info);
    },

    updateActiveMorph: function() {
        var m = this.morphs[this.activemorph];
        if (!m) return;

        m.count = m.count - 1;
        if (m.count <= 0) {
            m.count = 0;
            $('#morphs > div #' + (this.activemorph + 1)).data('info', 'Empty');
            $('#morphs > div #' + (this.activemorph + 1) + ' > figure').css('background-position', '0 0');
            $('#morphs > span').text('Empty');
        }
        $('#morphs > div #' + (this.activemorph + 1) + ' > span').text(m.count);
    },

    morph: function(other) {
        if (typeof(other) == "string") other = Object.$get(Entities, other);
        this.morphing = true;
        this.player.initMorph();
        this.morphSubject = other;
        p.setPaused(other.pauseWhileMorph);
    },

    respawnPlayer: function(dead) {
        if (this.player.isMorphing()) return;
        if (dead) {
            var color = $('body').css('background-color');
            $('body').animate({
                backgroundColor: jQuery.Color('#4F2222')
            }, 100, function() {
                $('body').animate({
                    backgroundColor: jQuery.Color(color)
                }, 100);
            });
            $('#container').fadeTo(50, 0.05).delay(100).fadeTo(300, 1);
        }
        this.player.setPos(this.spawn.x, this.spawn.y);
    },

    doMorph: function() {
        var other = this.morphSubject;
        if (this.morphing && !this.player.isMorphing()) {
            if (other.control) {
                this.player.removeBody();
                var i = this.entities.indexOf(this.player);
                this.player = new other(this.player.pos.x - this.player.offset.x, this.player.pos.y - this.player.offset.y);
                this.entities[i] = this.player;
            } else {
                var ent = new other(this.player.pos.x - this.player.offset.x, this.player.pos.y - this.player.offset.y);
                this.respawnPlayer();
                this.entities.push(ent);
            }
            this.morphing = false;
            p.setPaused(false);

            this.updateActiveMorph();
        }
    },

    applyScale: function(p) {
        return Math.round(p * config.display.scale);
    },

    setSpawn: function(x, y) {
        this.spawn.x = x;
        this.spawn.y = y;
    },

    initRegion: function(region) {
        if (region.name == "Spawn") {
            this.spawn.x = region.x;
            this.spawn.y = region.y;
        }
    },

    initLayer: function(layer) {
        if (layer.type == "tilelayer") {
            if (layer.properties.type == "perspective") {
                this.layers.push(new PerspectiveLayer(layer, this.width, this.height, this.tilewidth, this.tileheight));
            }
        } else if (layer.type == "objectgroup") {
            if (layer.properties.type == "collision") {
                this.layers.push(new CollisionLayer(layer));
            }
            if (layer.properties.type == "image") {
                this.layers.push(new ImageLayer(layer));
            }
            if (layer.properties.type == "entity") {
                for (var i = 0; i < layer.data.length; i++) {
                    var ent = layer.data[i];
                    var e = Object.$get(Entities, ent.name);
                    if (e && ent.type != "region") {
                        this.entities.push(new e(ent.x, ent.y, ent));
                    } else {
                        this.initRegion(ent);
                    }
                }
            }
        }
    },

    initLayers: function(layers) {
        for (var layer in layers)
            this.initLayer(layers[layer]);
    },

    update: function(game) {
        var i;
        for (i = 1; i < 7; i++) {
            if (Input.isPressed(Keys["_" + i])) {
                this.setActiveMorph(i - 1);
            }
        }

        for (i = 0; i < this.entities.length; i++) {
            this.entities[i].update(game);
        }

        this.camera.follow(this.player);

        if (Input.isPressed('morph')) {
            if (this.morphs[this.activemorph] && this.morphs[this.activemorph].count > 0) {
                this.morph(this.morphs[this.activemorph].type);
            }
        }

        this.doMorph();
    },

    draw: function(ctx) {
        for (var i = 0; i < this.layers.length; i++) {
            if (!this.layers[i].foreground) this.layers[i].draw(ctx);
        }

        this.entities.sort(function(a, b) {
            if (a.foreground) return 1;
            if (b.foreground) return -1;
            if (a.pos.y < b.pos.y) return 1;
            if (a.pos.y > b.pos.y) return -1;
            if (a.pos.x > b.pos.x) return 1;
            if (a.pos.x < b.pos.x) return -1;
            return 0;
        });

        for (var i = 0; i < this.entities.length; i++) {
            this.entities[i].draw(ctx);
        }

        for (var i = 0; i < this.layers.length; i++) {
            if (this.layers[i].foreground) this.layers[i].draw(ctx);
        }
    }
});


module.exports = Level;
