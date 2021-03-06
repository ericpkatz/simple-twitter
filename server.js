const express = require('express');
const app = express();
const redis = require('redis');
const redisClient = redis.createClient(process.env.REDIS_URL);

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
    const tweet = await Tweet.findByPk(req.params.id);
    const likes = await tweet.getLikeCount();
    res.send({ ...tweet.get(), likes});
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
  txt: STRING
});

Tweet.prototype.getLikeCount = function(){
  return new Promise((res, rej)=> {
    redisClient.get(this.id, (err, result)=> {
      if(err){
        rej(err);
      }
      else {
        res(result*1);
      }
    });
  });
}

const Like = conn.define('like', {
  ...uuid
});

Like.addHook('afterCreate', async function(like){
  return new Promise((res, rej)=> {
    redisClient.incr(like.tweetId, (err)=> {
      if(err){
        rej(err);
      }
      else {
        res();
      }
    });
  });
  /*
  const tweet = await Tweet.findByPk(like.tweetId); 
  tweet._likes++;
  await tweet.save();
  */
});

Like.belongsTo(Tweet);
Tweet.hasMany(Like);

const init = async()=> {
  try {
  const port = process.env.PORT || 3000;
  app.listen(port, ()=> console.log(`listening on ${port}`));
  await new Promise((res, rej)=> {
    redisClient.flushall((err)=> {
      if(err){
        rej(err);
      }
      else {
        res();
      }
    });
  });
  await conn.sync({ force: true});
  const tweet = await Tweet.create({ txt: 'hello world'});
  const likes = new Array(10).fill('').map(_ => {
    return {
      tweetId: tweet.id
    };
  }); 
    /*
  for(let i = 0; i < likes.length; i++){
    await Like.create(likes[i]);
  }*/
  await Promise.all(likes.map( like => Like.create(like)));
  await tweet.reload();
  console.log(tweet._likes);
  }
  catch(ex){
    console.log(ex);
  }
};

init();

