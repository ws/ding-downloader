import Promise from "bluebird";
import fs from "promise-fs";
import path from "path";
import request from "request-promise";
import pThrottle from "p-throttle";

const ARGV = process.argv.slice(2);

// CONFIGURATION
// *************
//
// Your session ID, which you get from logging into Ring.com, opening dev tools, and copying the _session_id Cookie's value
const SESSION_ID = ARGV[0] || "PUTYOURSESSIONTOKENHERE";
//
// Do you want to save metadata?
const SAVE_METDATA = true;
const METADATA_DIRECTORY = `output/metadata`;
// Do you want to save videos? (I can't imagine the answer is no)
const SAVE_VIDEOS = true;
const VIDEO_PATH_FN = (doorbotId, dingId) =>
  `output/videos/${doorbotId}/${dingId}.mp4`;
// What is the most you want to hit the Ring API per minute?
const RING_LIMIT = 20;
// What is the most you want to hit S3 per minute? Note that they sign each download and probably have some sort of rate limiting
const S3_LIMIT = 40;
// How many videos do you want to fetch? The Ring web app usually goes in batches of 50, but something tells me it'll go further
// if you put something giant like, say, I dunno, 5,000? 50,000?
const FETCH_DINGS_LIMIT = 50;

// There's actually some cool meatadata info returned by the events API, so save that in case I later need to actually do anything
// with the raw video clips
const saveMetadata = metadata =>
  fs.writeFile(
    path.join(METADATA_DIRECTORY, `${metadata.id}.json`),
    JSON.stringify(metadata)
  );

const _hitTheRingAPI = endpoint =>
  request({
    url: `https://ring.com/${endpoint}`,
    headers: { Cookie: `_session_id=${SESSION_ID}` }
  }).then(JSON.parse); // unsafe JSON parse but yolo

const hitTheRingAPI = pThrottle(_hitTheRingAPI, RING_LIMIT, 60000);

// Get n events events
const getDingHistory = limit =>
  hitTheRingAPI(`/account/activity/fetch_dings?limit=${limit}`).then(
    data => data.dings
  );

const getDingVideoUrl = (doorbotId, dingId) =>
  hitTheRingAPI(`/account/api/devices/${doorbotId}/dings/${dingId}/view`).then(
    data => data.url
  );

// Get the video from S3 with the signed URL
const _downloadVideo = (url, doorbotId, dingId) =>
  new Promise((resolve, reject) => {
    request(url)
      .on("error", reject)
      .on("end", resolve)
      .pipe(fs.createWriteStream(VIDEO_PATH_FN(doorbotId, dingId)));
  });

const downloadVideo = pThrottle(_downloadVideo, S3_LIMIT, 60000);

console.log(`Getting ${FETCH_DINGS_LIMIT} latest events...`);

FETCH_DINGS_LIMIT >= 500 &&
  console.log("Be patient, this could take a few seconds...");

getDingHistory(FETCH_DINGS_LIMIT)
  .then(async dings => {
    return Promise.each(dings, async d => {
      const { id, doorbot } = d;
      const videoUrl = await getDingVideoUrl(doorbot.id, id);

      if (SAVE_METDATA) {
        await saveMetadata(d);
      }

      if (SAVE_VIDEOS) {
        console.log(`Downloading ${VIDEO_PATH_FN(doorbot.id, id)}`);
        await fs.mkdir(path.resolve(VIDEO_PATH_FN(doorbot.id, "_"), "../"), {
          recursive: true
        });
        await downloadVideo(videoUrl, doorbot.id, id);
      }
    });
  })
  .catch(e => {
    console.log({ e });
  });
