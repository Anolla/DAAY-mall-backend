/* eslint-disable comma-dangle */
'use strict';
const schema = require('./user-schema.js');
const jwt = require('jsonwebtoken');
const SECRET = process.env.SECRET || 'oursecret';
const Model = require('./mongo');
require('dotenv').config();

// main user collection class
class UserCollection {
  constructor() {
    this.schema = schema;
  }

  // method to create new users
  async create(userInfo) {
    let that = this;
    console.log('hello');
    return new Promise(function (res, rej) {
      try {
        let user = new that.schema(userInfo);
        user
          .save()
          .then((data) => {
            return res(data.populate('acl').execPopulate());
          })
          .catch((e) => {
            console.log(e.message);
            rej(new Error({ status: 500, message: e.message }));
          });
      } catch (e) {
        console.log(e.message, 'bsbs');
        rej(
          new Error({ status: 500, message: 'Error in creating a new user.' })
        );
      }
    });
  }

  // method for getting form user collection in the schema
  async read(userInfo) {
    if (userInfo !== undefined) {
      let record = await this.schema
        .findOne({
          email: userInfo.email,
        })
        .populate('acl')
        .populate('wishlist')
        .populate('review')
        .populate('productID')
        .populate('cart');
        // .exec();

      if (record) {
        let valid = await this.schema.authenticateUser(
          userInfo.password,
          record.password
        );
        if (valid) {
          let token = await this.schema.generateToken(record._id);
          let userWithNewToken = await this.schema
            .findOneAndUpdate({ _id: record._id }, { token }, { new: true })
            .populate('acl')
            .populate('wishlist')
            .populate('review')
            .populate('productID')
            .exec();
          return userWithNewToken;
        } else {
          return 'Not The same pass';
        }
      } else {
        return { status: 401, message: 'User is not found!' };
      }
    } else {
      let record = await this.schema
        .find({})
        .populate('acl')
        .populate('review')
        .populate('wishlist')
        .populate('productID')
        .exec();
      return record;
    }
  }

  async readForResetPassword(email) {
    try {
      let record = await this.schema.findOne(email);
      if (record) return Promise.resolve(record);
      else return Promise.reject('user is not signup');
    } catch (e) {
      return e.message;
    }
  }
  async update(obj, update) {
    console.log(obj, 'update');
    return await this.schema.findOneAndUpdate(obj, update, { new: true });
  }
}

class Users extends Model {
  constructor() {
    super(schema);
  }
  async save(record) {
    const result = await this.get({ username: record.username });
    if (result.length == 0) {
      const user = await this.create(record);
      return user;
    }
  }

  generateToken(user) {
    const token = jwt.sign(
      {
        username: user.username,
        id: user._id,
        exp: Math.floor(Date.now() / 1000) + 15 * 60,
        capabilities: user.acl ? user.acl.capabilities : [],
        type: user.type || 'user',
      },
      SECRET
    );
    return token;
  }
}

module.exports.userCollection = new UserCollection();
module.exports.users = new Users();
