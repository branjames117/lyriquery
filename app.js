// INITIALIZE APP //////////////////////////////////////////////////////////////////////
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const uri = 'mongodb+srv://' + process.env.DB_USER + ':' + process.env.DB_PASS + '@' + process.env.DB_HOST;

const app = express();

app.set('view engine', 'ejs');

app.use(express.urlencoded({extended: true}));
app.use(express.static("public"));

// MONGOOSE CODE ////////////////////////////////////////////////////////////////////////
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
const songSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'No song title provided.']
  },
  artist: { 
    type: String,
    required: [true, 'No song artist provided.']
  },
  featuredArtist: {
    type: String
  },
  album: {
    type: String,
    required: [true, 'No song album provided.']
  },
  year: {
    type: Number,
    required: [true, 'No song year provided.']
  },
  authors: {
    type: Array,
  },
  lyrics: {
    type: Array,
    required: [true, 'No song lyrics provided.']
  },
  trackNumber: {
    type: Number,
    required: [true, 'No track number provided.']
  }
});
const Song = mongoose.model('Song', songSchema);

// GET ROOT / HOME / SEARCH ROUTE ////////////////////////////////////////////////////////
app.get('/', (req, res) => {
  res.render('home');
});

// GET DATABASE ROUTE ///////////////////////////////////////////////////////////////////
app.get('/database', (req, res) => {
  Song.find({}, (err, doc) => {
    if (err) res.render('error', { err: 'Could not access the database! Contact your administrator.' });
    // send all database entries as an array to the database route
    res.render('database', { entries: doc });
  });
});

// GET DOCUMENTATION / ABOUT ROUTE //////////////////////////////////////////////////////
app.get('/doc', (req, res) => {
  res.render('doc');
});

// GET SUBMISSION ROUTE ///////////////////////////////////////////////////////////////
app.get('/submit', (req, res) => {

  if (req.body.update) {
    Song.findOne({ _id: update }, (err, song) => {
      if (err) res.render('error', { err: 'Song ID not found in the database. Something went wrong.' });
      res.render('submit', { song: song });
    });
  } else {
    let song = {
      artist: null,
      featuredArtist: null,
      title: null,
      trackNumber: null,
      album: null,
      authors: null,
      year: null,
      lyrics: []
    }
    res.render('submit', { song: song });
  }
});

// DATABASTE UPDATE ROUTE ///////////////////////////////////////////////////////////////
app.post('/submit', (req, res) => {
  // update posted to submit route, must be a request to update a song, redirect
  if (req.body.update) {
    Song.findOne({ _id: req.body.update }, (err, song) => {
      if (err) res.render('error', { err: 'Song ID not found in the database. Something went wrong.' });
      res.render('submit', { song: song });
      });
  // songID posted to submit route, must be an update in progress, redirect
  } else if (req.body.songID) {
    Song.findOne({ _id: req.body.songID }, (err, song) => {
      if (err) res.render('error', { err: 'Song ID not found in the database. Something went wrong.' });
      song.artist = req.body.artist;
      song.featuredArtist = req.body.featured;
      song.title = req.body.title;
      song.trackNumber = req.body.track;
      song.album = req.body.album;
      song.authors = req.body.authors.replace(', ', ',').split(',');
      song.year = req.body.year;
      song.lyrics = req.body.lyrics.split('\r\n').filter(line => line.length > 0);
      song.save((error) => {
        if (error) {
          res.render('error', { err: 'Validation error. Be sure to fill out all required fields.' });
        } else {
        res.redirect('/database');
        }
      });
    });
  // no update nor songID posted, must be a new submission, redirect
  } else {
    let song = new Song({
      title: req.body.title,
      artist: req.body.artist,
      featuredArtist: req.body.featured,
      album: req.body.album,
      year: req.body.year,
      authors: req.body.authors.replace(', ', ',').split(','),
      trackNumber: req.body.track,
      // split the lyrics input into an array of strings separated by \r\n, then filter out empty strings
      lyrics: req.body.lyrics.split('\r\n').filter(line => line.length > 0)
    });
    // check if song title/artist combination already exists in database
    Song.exists({ title: req.body.title, artist: req.body.artist }, (err, doc) => {
      if (err) res.render('error', { err: 'Could not access the database! Contact your administrator.' });
      // if song already exists, send to error route
      if (doc) res.render('error', { err: 'Song title already exists in database!' });
      // else save it to the database
      song.save((error) => {
          if (error) {
            res.render('error', { err: 'Validation error. Be sure to fill out all required fields.' });
          } else {
          res.redirect('/database');
          }
        }
        );
      }
    );
  }
});

// NORMALIZE STRINGS FUNCTION //////////////////////////////////////////////////////////
function normalizeStr(str) {
  return str.toLowerCase().replace('in\'', 'ing').replace(/[,.;()\"\']/g,'');
}

// DATABASTE QUERY ROUTE ///////////////////////////////////////////////////////////////
app.post('/results', (req, res) => {
  // start with an empty array
  let matches = [];

  Song.find({ artist: { $regex: req.body.artist }}, (err, doc) => {
    doc.forEach((song) => {
      song.lyrics.forEach((line, index) => {
        // ternary operator: if iterated line contains the query, push it to the matches array, else, do nothing
        normalizeStr(line).includes(normalizeStr(req.body.query))
        ? matches.push({id: song._id, title: song.title, artist: song.artist, trackNumber: song.trackNumber, featuredArtist: song.featuredArtist, album: song.album, year: song.year, authors: song.authors, lineNumber: index + 1, line: line})
        : null;
      });
    });
    // sort matches by year, looks cleaner when displayed
    matches.sort((a, b) => {
      return b.year - a.year;
    });
    res.render('results', { matches: matches, query: req.body.query, artist: req.body.artist });
  });
});

// GET SPECIFIC SONG ROUTE ///////////////////////////////////////////////////////////////
app.get('/song/:songID', (req, res) => {
  let songID = req.params.songID;
  Song.findOne({ _id: songID }, (err, song) => {
    if (err) res.render('error', { err: 'Song ID not found in the database. Something went wrong.' });
    res.render('song', { song: song });
  });
});

// GET ALL ARTISTS ROUTE ///////////////////////////////////////////////////////////////
app.get('/artist/', (req, res) => {
  res.redirect('/database');
});

// GET SPECIFIC ARTIST ROUTE ///////////////////////////////////////////////////////////////
app.get('/artist/:artistID', (req, res) => {
  let artist = req.params.artistID;
  Song.find({ artist: artist }, (err, songs) => {
    if (err) console.error(err);
    res.render('artist', { artist: artist, songs: songs });
  });
});

// GET SPECIFIC ALBUM ROUTE ///////////////////////////////////////////////////////////////
app.get('/artist/:artistID/:albumID', (req, res) => {
  let artist = req.params.artistID;
  let album = req.params.albumID;
  Song.find({ artist: artist, album: album }, (err, songs) => {
    if (err) console.error(err);
    res.render('album', { artist: artist, album: album, songs: songs });
  });
});

// DELETE SONG ROUTE ///////////////////////////////////////////////////////////////////
app.post('/delete', (req, res) => {
  Song.deleteOne({ _id: req.body.delete }, (err) => {
    if (err) res.render('error', { err: 'Song ID not found in the database. Something went wrong.' });
    res.redirect('/database');
  });
});

// SERVER LISTEN ON PORT 3000 /////////////////////////////////////////////////////////
app.listen(process.env.PORT, function() {
  console.log(`Server started on port ${process.env.PORT}`);
});