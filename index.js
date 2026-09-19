const express = require('express');
const ytdl = require('ytdl-core');

const app = express();
const port = process.env.PORT || 3000;

app.get('/download', async (req, res) => {
    const videoUrl = req.query.url;

    if (!videoUrl || !ytdl.validateURL(videoUrl)) {
        return res.status(400).send('Valid YouTube URL required');
    }

    try {
        const info = await ytdl.getInfo(videoUrl);
        const format = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' });
        res.header('Content-Disposition', `attachment; filename="${info.videoDetails.title}.mp4"`);

        ytdl(videoUrl, { quality: 'highestvideo' }).pipe(res);
    } catch (err) {
        res.status(500).send('Error processing video');
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
