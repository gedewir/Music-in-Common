const Buffer = require('buffer').Buffer
const  express = require('express');
const app = express();
const rp = require('request-promise');
const axios = require('axios');
const { get } = require('request');
require('dotenv').config();

//converting to client ID and client secret to base64 format
var clientCombo = `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`;
const clientAuth = Buffer.from(clientCombo, 'utf-8').toString("base64");

//use the port assigned in port environment variable or 3000 if none selected
const port = process.env.PORT || 3000;
app.listen(port);
console.log(`App listening on https://localhost:${port}`);

app.use(express.json());

//url and parameters to POST to recieve access token from Spotify using client credentials flow
var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
        'Authorization': `Basic ${clientAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
    },
    form: {
        'grant_type': 'client_credentials'
    }}

//async function to request token and returns the access token as variable
const reqToken = async () =>{
    try{
        var tokenData = await rp.post(authOptions);
        var jsonToken = JSON.parse(tokenData);
        var accessToken = jsonToken.access_token;
        return accessToken;
    }
    catch (error){
        console.log(error);
    }
}

const spotifyURL = 'https://api.spotify.com/v1/';

// callback function to return both user's playlists as nested URL eg. [[URL, URL,...],[URL, URL,...]]
function getNestedURL(items){
    var nestedURL = [];
    items.forEach(item => {
        nestedURL.push(item.href);
    });
    return nestedURL;
}

//async function to return spotify URL playlists
const getPlaylistURLs = async(users, access_token, callback)=>{
    try{
        //empty array which will be populated
       var userPlaylists = [];
       //get request of the individual and playlist they publicly share
       for (user of users) {
            const response = await axios.get(`${spotifyURL}users/${user}/playlists`,access_token);
            items  = response.data.items;
            var i = callback(items);
            userPlaylists.push(i);
        }
       return userPlaylists;
    } 
        catch (error){
            console.log(error);
    }
}

// callback function to determine whether two track IDs are equal string values
function getMatchedTrackIDs(bothUserTrackIDs){
    // empty array where matched tracks will be populated
    var matchedTrack = [];
    // array of user 1 and 2
    var user1_tracks = bothUserTrackIDs[0];
    var user2_tracks = bothUserTrackIDs[1];
    //for loop, selecting user 1 song
    user1_tracks.forEach(element => {
        //for loop, selecting the user2 track
        for (let i=0; i < user2_tracks.length; i++){
            //if the selected user 1 song and user2 song == true, append to the matchedTracks[] array
            if (element.id == user2_tracks[i].id){
                matchedTrack.push(element);
            }
        };
    });
    return matchedTrack;
};

//async functtion to retrieve all tracks inside all users playlists
const getMatchedTracks = async(playlistArray, access_token,callback)=>{
    try{    
            //empty array which both users' tracks will be populated in format = [ [trackID, trackID,...], [trackID, trackID...]  ]
            var tracks = [];
            
            //for each user's playlist loop
            for (playlist of playlistArray){
                //empty array where the trackIDs of each user will be placed in... will be pushed onto tracks[] up above once loop is finished
                var UserTrackIDs= [];
                //for loop each users playlist -> get the playlist tracks in an array ->loop again 
                for(playlistURL of playlist){
                    const response = await axios.get(`${playlistURL}/tracks?offset=0&limit=100`, access_token);
                    playlistTrackArray = response.data.items
                     
                    playlistTrackArray.forEach(element => {
                        if (element.track !== null){
                            UserTrackIDs.push(element.track);
                        }
                    });
                };
                tracks.push(UserTrackIDs);
            }
           
       var matchedTracks =  callback(tracks);
       return matchedTracks;
    }
    catch(error){
        console.log(error);
    }
}

app.get('/:user_id1/:user_id2', (req,res)=>{
    input_users = [req.params.user_id1, req.params.user_id2]
    reqToken()
    .then(accessToken =>{
        console.log(accessToken);
        var accessTokenConfig =  {
            headers:{
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'}
            };
       getPlaylistURLs(input_users,accessTokenConfig,getNestedURL)
            .then(responseDataArray=>getMatchedTracks(responseDataArray, accessTokenConfig,getMatchedTrackIDs)
                 .then(responseData=>res.send(responseData)));
       })

});
