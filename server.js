const express = require('express');
const app = express();
const Sequelize = require('sequelize');
const { DataTypes: { INTEGER, STRING, UUID, UUIDV4 } } = Sequelize;
const conn = new Sequelize(process.env.DATABASE_URL || 'postgres://localhost/acme_db');


app.get('/api/tweets', async(req, res, next)=> {
  try {
    res.send(await Tweet.findAll());
  }
  catch(ex){
    next(ex);
  }
});

app.get('/api/tweets/:id', async(req, res, next)=> {
  try {
    res.send(await Tweet.findByPk(req.params.id, {
      include: [Like]
    }));
  }
  catch(ex){
    next(ex);
  }
});

const uuid = {
  id: {
    type: UUID,
    defaultValue:UUIDV4,
    primaryKey: true
  }
};
const Tweet = conn.define('tweet', {
  ...uuid,
  txt: STRING,
  _likes: {
    type: INTEGER,
    defaultValue: 0
  }
});

const Like = conn.define('like', {
  ...uuid
});

Like.addHook('afterCreate', async function(like){
  const tweet = await Tweet.findByPk(like.tweetId); 
  tweet._likes++;
  await tweet.save();
});

Like.belongsTo(Tweet);
Tweet.hasMany(Like);

const init = async()=> {
  try {
  const port = process.env.PORT || 3000;
  app.listen(port, ()=> console.log(`listening on ${port}`));
  await conn.sync({ force: true});
  const tweet = await Tweet.create({ txt: 'hello world'});
  const likes = new Array(4).fill('').map(_ => {
    return {
      tweetId: tweet.id
    };
  }); 
  /*
  for(let i = 0; i < likes.length; i++){
    await Like.create(likes[i]);
  }
  */
  await Promise.all(likes.map( like => Like.create(like)));
  await tweet.reload();
  console.log(tweet._likes);
  }
  catch(ex){
    console.log(ex);
  }
};

init();

