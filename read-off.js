var polyhedron={};
polyhedron.create=function(offFile) {
	$.get(offFile, function(data) {
		var shape = polyhedron.getOffShape(data);
		console.log('shape', shape);
		if (shape) {
			polyhedron.triangulate(shape)
		}
	});
};
polyhedron.getOffShape=function(data) {
	states = {
		'checkOff': 0,
		'readSizes': 1,
		'readVs': 2,
		'readFs': 3,
		'readOk': 4
	};
	var shape = {};
	var nrRead = 0;
	var state = states.checkOff;
	var lines = data.split('\n');
	var error = false
	for (var i = 0; i < lines.length; i++) {
		if (!lines[i].match(/\s*(#)/) && lines[i] != "") {
			var words = lines[i].match(/\s*(\S+)/g)
			switch (state) {
			case states.checkOff:
				error = words[0] != 'OFF';
				if (!error) {
					state = states.readSizes;
					console.log('OFF file format recognised')
				} else {
					console.error("file should start with keyword 'OFF'");
				}
				break;
			case states.readSizes:
				var nrOfVs = parseInt(words[0]);
				var nrOfFs = parseInt(words[1]);
				var nrOfEs = parseInt(words[2]);
				shape.Vs = new Array(nrOfVs);
				shape.Fs = new Array(nrOfFs);
				shape.Es = [];
				shape.cols = new Array(nrOfFs);
				console.log('will read', nrOfVs, 'Vs', nrOfFs, 'Fs (', nrOfEs, 'edges)');
				state = states.readVs;
				break;
			case states.readVs:
				error = words.length < 3;
				if (!error) {
					shape.Vs[nrRead] = [
						parseFloat(words[0]),
						parseFloat(words[1]),
						parseFloat(words[2])];
					console.log(shape.Vs[nrRead]);
					nrRead += 1;
					if (nrRead >= shape.Vs.length) {
						console.log('read Vs done');
						state = states.readFs;
						nrRead = 0;
					}
				} else {
					console.error('error reading vertex', nrRead);
				}
				break;
			case states.readFs:
				var n = parseInt(words[0]);
				error = (words.length != n + 1) && (
					words.length != n + 4);
				if (!error) {
					var face = new Array(n);
					for (var j = 0; j < n; j++) {
						face[j] = parseInt(words[j+1]);
					}
					if (n >= 3) {
						shape.Fs[nrRead] = face;
					} else if (n == 2) {
						shape.Es.push(face);
					} // else ignore, but count
					var col = new Array(3);
					if (words.length == n + 1) {
						col = [0.8, 0.8, 0.8];
					} else {
						for (var j = 0; j < 3; j++) {
							ch = parseFloat(words[n+1+j]);
							if (ch < 1) {
								col[j] = ch;
							} else {
								col[j] = ch / 255;
							}
						}
					}
					shape.cols[nrRead] = col;
					console.log('face', face, 'col', col);
					nrRead += 1;
					console.log(nrRead, shape.Fs.length);
					if (nrRead >= shape.Fs.length) {
						state = states.readOk;
						console.log('Done reading OFF file');
						nrRead = 0;
					}
				} else {
					console.error('error reading face', nrRead);
					console.log(words.length, '!=', n+1, 'or', n+4);
				}
				break;
			}
			if (error) {
				break;
			}
		}
	}
	if (state != states.readOk) {
		console.error('Error reading OFF file');
	}
	if (!error) {
		return shape;
	} else {
		return null;
	}
}
polyhedron.triangulate=function(shape) {
	ts = [];
	for (var n = 0; n < shape.Fs.length; n++) {
		var triF = [];
		var f = shape.Fs[n];
		if (f.length == 3) {
			ts.push(f);
		} else {
			for (var i = 1; i < f.length - 1; i++) {
				// i+1 before i, to keep clock-wise direction
				triF = triF.concat([f[0], f[i+1], f[i]]);
			}
			console.log('triangulate face', n, triF);
			ts.push(triF);
		}
	}
	shape.triangulatedFs = ts
}

// vim: set noexpandtab sw=8
