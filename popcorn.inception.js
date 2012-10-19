// PLUGIN: inception

(function (Popcorn) {

	"use strict";

	var styleSheet,
		mediaTypes = {
			'webm': 'video',
			'mp4': 'video',
			'm4v': 'video',
			'ogv': 'video',

			'mp3': 'audio',
			'oga': 'audio',
			'ogg': 'audio',
			'aac': 'audio',
			'wav': 'audio'
		};

	function guessMediaType(sources) {
		var ext, i;

		for (i = 0; i < sources.length; i++) {
			ext = /\.([a-z]+)$/i.exec(sources[i]);
			if (ext) {
				ext = ext[1];
				if (mediaTypes[ext]) {
					return mediaTypes[ext];
				}
			}
		}

		return false;
	}

	Popcorn.basePlugin('inception', function (options, base) {
		var me = this,
			popcorn,
			media,
			container, div, doc, iframe,
			sources,
			mediaType,
			i, events, evt, eventType,
			from, to,
			duration = Infinity,
			popcornOptions,
			targetTime;

		function seek(time) {
			function seekWhenReady() {
				duration = popcorn.duration();
				popcorn.currentTime(targetTime);
				popcorn.off('loadedmetadata', seekWhenReady);
			}

			if (popcorn.duration()) {
				popcorn.currentTime(time);
			} else {
				if (targetTime === undefined) {
					popcorn.on('loadedmetadata', seekWhenReady);
				}
				targetTime = time;
			}
		}

		function playOnStart() {
			var time = 0;
			//if options.sync, advance to appropriate time
			if (options.sync) {
				time = me.currentTime() - options.start + from;
			}
			if (time < to) {
				seek(time);
				popcorn.play();
			} else {
				seek(Math.min(to, duration));
			}
		}

		function mainVideoPaused() {
			popcorn.pause();
		}

		function mainVideoSeeking() {
			popcorn.pause();
			var time = 0;
			//if options.sync, advance to appropriate time
			if (options.sync) {
				time = me.currentTime() - options.start + from;
			}
			if (time >= to) {
				time = Math.min(to, duration);
			}
			seek(time);
		}

		function mainVideoSeeked() {
			if (!me.paused()) {
				playOnStart();
			}
		}

		if (!base.target) {
			return;
		}

		//todo: don't require options.source if null player is available
		sources = base.toArray(options.source);
		if (!sources || !sources.length) {
			return;
		}

		//todo: use Popcorn.smart if available
		mediaType = options.type || guessMediaType(sources);
		if (!mediaType) {
			return;
		}

		//todo: if no sources pass canPlayType, return null

		//todo: add stylesheet with basePlugin
		if (!styleSheet) {
			styleSheet = document.createElement('style');
			styleSheet.setAttribute('type', 'text/css');
			styleSheet.appendChild(
				document.createTextNode(
					'.popcorn-inception { display: none; }\n' +
					'.popcorn-inception > div { position: relative; }\n' +
					'.popcorn-inception > div > * { max-width: 100%; }\n' +
					'.popcorn-inception.active { display: inline-block; }\n'
			));
			document.head.appendChild(styleSheet);
		}

		container = options.container = base.makeContainer();
		if (options.id) {
			container.id = options.id;
		}
		base.animate(container);
		div = document.createElement(options.tag || 'div');
		container.appendChild(div);

		if (div.tagName === 'IFRAME') {
			doc = div.contentDocument;
			iframe = div;
			div = doc.body;
		} else {
			doc = document;
		}

		media = doc.createElement(mediaType);
		media.setAttribute('preload', 'auto');
		Popcorn.forEach(sources, function(url) {
			var source = doc.createElement('source');
			//todo: if from/to and mediaType is video|audio, add #t={from},{to}
			source.setAttribute('src', url);
			media.appendChild(source);
		});
		if (options.poster) {
			media.setAttribute('poster', options.poster);
		}
		div.appendChild(media);

		popcornOptions = Popcorn.extend({}, me.options);
		Popcorn.extend(popcornOptions, options.options || {});
		popcorn = Popcorn(media, popcornOptions);

		if (iframe) {
			popcorn.on('loadedmetadata', function() {
				iframe.width = media.videoWidth || media.width;
				iframe.height = media.videoHeight || media.height;
			});
		}

		if (options.from > 0) {
			from = options.from;
			seek(from);
		} else {
			from = 0;
		}

		if (options.to > Math.max(0, from)) {
			to = options.to;
			popcorn.cue(to, function() {
				popcorn.pause();
			});
		} else {
			to = Infinity;
		}
		popcorn.on('loadedmetadata', function() {
			to = Math.min(to, popcorn.duration());
			to = Math.min(to, from + (options.end - options.start));
		});

		//todo: option to pause main video

		//set up popcorn events
		if (options.events) {
			if (Popcorn.isArray(options.events)) {
				for (i = 0; i < options.events.length; i++) {
					evt = options.events[i];
					eventType = evt._type;
					if (eventType && Popcorn.registryByName[eventType]) {
						evt = Popcorn.extend({}, evt);
						delete evt._type;
						popcorn[eventType](evt);
					}
				}
			} else if (typeof options.events === 'object') {
				for (eventType in options.events) {
					if (Popcorn.registryByName[eventType]) {
						events = options.events[eventType];
						for (i = 0; i < events.length; i++) {
							evt = eventsp[i];
							popcorn[eventType](evt);
						}
					}
				}
			}
		}

		return {
			start: function(event, options) {
				var time;
				base.addClass(container, 'active');

				if (options.sync) {
					me.on('pause', mainVideoPaused);
					me.on('seeking', mainVideoSeeking);
					me.on('seeked', mainVideoSeeked);
				}

				me.on('play', playOnStart);
				if (!me.paused()) {
					playOnStart();
				}
			},
			end: function(event, options) {
				popcorn.pause();
				me.off('play', playOnStart);

				base.removeClass(container, 'active');

				//remove any seeking/seeked listeners on 'me'
				me.off('pause', mainVideoPaused);
				me.off('seeking', mainVideoSeeking);
				me.off('seeked', mainVideoSeeked);
			},
			_teardown: function(event, options) {
				popcorn.destroy();
			}
		};
	}, {
		about: {
			name: 'Popcorn Inception Plugin',
			version: '0.1',
			author: 'Brian Chirls, @bchirls',
			website: 'http://github.com/brianchirls'
		},
		incompatible: function() {
			return navigator.userAgent.match(/iP(od|ad|hone)/i) &&
				'Browser is unable to play multiple simultaneous media.';
		}
	});
}(Popcorn));