// This script queries the USGS National Water Data database
// for hourly reservoir guages for reservoirs in California (2007 - 2014)
// and then coverts that data into GeoJSON with monthly averages.

var http = require('http');
var fs = require('fs');

var filename = './usgsFull.txt';

// Check to see if the file with the data exists,
// if it does, do not query for it again, just process it into geojson
if (fs.stat(filename, function(err, stats){
	if (err) return getData();
	if (stats) return cleanData();
}))

function getData(){
	// list of reservoir sites available from USGS;
	var reservoirs = [ 
		'09427500',
		'10292500',
		'10308785',
	 	'10308785',
	 	'10337000',
	 	'10338400',
	 	'10340300',
	 	'10342900',
	 	'10344300',
	 	'10344490',
	 	'11020600',
	 	'11022100',
	 	'11042510',
	 	'11109700',
	 	'11122000',
	 	'11128300',
	 	'11275500',
	 	'11277200',
	 	'11277500',
	 	'11287500',
	 	'11450000',
	 	'11451290' 
	];
	var startDate = '2007-10-01',
		endDate = '2014-10-07',
		data = '',
		url = 'http://nwis.waterdata.usgs.gov/nwis/uv?cb_00054=on&format=rdb&multiple_site_no='+reservoirs.join(',')+'&period=&begin_date='+startDate+'&end_date='+endDate;

	// request the data from USGS, save data to a txt file
	http.get(url, function(res){
		res.on('data', function(chunk){
			data += chunk;
		});
		res.on('end', function(){
			fs.writeFile(filename, data, function(err){
				if (err) throw err;
				console.log('Filed Saved!');
				cleanData();
			});
		});
	});

}

function cleanData(){
	// get the metadata about the reservoir sites from this inventory file
	var inventory = fs.readFileSync('./inventory.txt', {encoding: 'utf8'}).split('\n');
	var reservoirs = {};

	for (var i in inventory){
		if (inventory[i][0] !== '#' && inventory[i][0]){
			var line = inventory[i].split('\t');
			if (line[0] === '15s' || line[0] === 'site_no') continue;
			var id = line[0];
			var name = line[1];
			var lat = parseFloat(line[2]);
			var lng = parseFloat(line[3]);
			reservoirs[id] = reservoirs[id] || {};
			reservoirs[id].type = 'Feature';
			reservoirs[id].properties = reservoirs[id].properties || {};
			reservoirs[id].properties.id = id;
			reservoirs[id].properties.Name = name;
			reservoirs[id].properties.Description = name;
			reservoirs[id].geometry = {};
			reservoirs[id].geometry.type = 'Point';
			reservoirs[id].geometry.coordinates = [lng, lat];
		}
	}

	// read the file with the time series data
	fs.readFile(filename, {encoding: 'utf8'}, function(err, data){
		if (err) throw err;
		data = data.split('\n');

		var id,
			re = /# Data provided for site/;

		// for each line in the file, determine whether there is data,
		// which site it refers to, and create an array of readings by month
		for (var i in data){
			if (data[i][0] !== '#'){
				if (!data[i]) continue;
				var line = data[i].split('\t');
				if (line[0] === '5s' || line[0] === 'agency_cd') continue;
				var id = line[1];
				var date = line[2].split(' ')[0].slice(0, -3);
				var value = line[4];
				reservoirs[id] = reservoirs[id] || {};
				reservoirs[id].properties[date] = reservoirs[id].properties[date] || [];
				reservoirs[id].properties[date].push(parseInt(value));
			}
		}

		// turn each array of hourly readings into a monthly average
		for (var i in reservoirs){
			for (var ix in reservoirs[i].properties){
				if (/\d{4}\-\d{2}/.test(ix)){
					var average = reservoirs[i].properties[ix].reduce(function(prev, cur, i, array){
						return prev + cur;
					});

					average = Math.floor(average / reservoirs[i].properties[ix].length);
					reservoirs[i].properties[ix] = average;
				}
			}
		}

		// structure the geojson and save it to a file
		var geojson = {};
		geojson.type = 'FeatureCollection';
		geojson.crs = { 'type': 'name', 'properties': { 'name': 'urn:ogc:def:crs:OGC:1.3:CRS84' } };
		geojson.features = [];

		for (var i in reservoirs){
			geojson.features.push(reservoirs[i])
		}

		fs.writeFile('usgsReservoir.json', JSON.stringify(geojson), function(err){
				if (err) throw err;
				console.log('GeoJSON saved');
			});
	});
};