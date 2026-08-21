# MongoDB Schemas - JDV GLOBAL

## Collections Overview

MongoDB is used for flexible, document-based storage of:
- Analytics data
- Logs and events
- User-generated content
- Real-time data (temporary)
- Time-series data

---

## 1. Analytics Collection

```javascript
db.createCollection('analytics', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'event', 'timestamp'],
      properties: {
        _id: { bsonType: 'objectId' },
        userId: { bsonType: 'string', description: 'UUID from PostgreSQL' },
        event: { 
          bsonType: 'string',
          enum: ['PAGE_VIEW', 'CLICK', 'SEARCH', 'PURCHASE', 'LOGIN', 'SIGNUP', 'ERROR']
        },
        module: { bsonType: 'string' },
        metadata: { bsonType: 'object' },
        timestamp: { bsonType: 'date' },
        sessionId: { bsonType: 'string' },
        ipAddress: { bsonType: 'string' },
        userAgent: { bsonType: 'string' },
        country: { bsonType: 'string' },
        city: { bsonType: 'string' },
        deviceType: { bsonType: 'string', enum: ['desktop', 'mobile', 'tablet'] }
      }
    }
  }
});

// Indexes for analytics
db.analytics.createIndex({ 'userId': 1, 'timestamp': -1 });
db.analytics.createIndex({ 'event': 1, 'timestamp': -1 });
db.analytics.createIndex({ 'module': 1, 'timestamp': -1 });
db.analytics.createIndex({ 'timestamp': -1 }, { expireAfterSeconds: 7776000 }); // 90 days
```

---

## 2. Events Collection (Real-time event bus)

```javascript
db.createCollection('events', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['eventType', 'payload', 'timestamp'],
      properties: {
        _id: { bsonType: 'objectId' },
        eventType: { 
          bsonType: 'string',
          enum: [
            'PAYMENT_INITIATED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED',
            'ORDER_CREATED', 'ORDER_UPDATED', 'ORDER_CANCELLED',
            'RIDE_STARTED', 'RIDE_COMPLETED',
            'PROPERTY_LISTED', 'PROPERTY_SOLD',
            'USER_CREATED', 'USER_UPDATED',
            'COMMISSION_EARNED', 'PAYOUT_INITIATED'
          ]
        },
        module: { bsonType: 'string' },
        payload: { bsonType: 'object' },
        userId: { bsonType: 'string' },
        relatedId: { bsonType: 'string' },
        relatedType: { bsonType: 'string' },
        status: { bsonType: 'string', enum: ['PENDING', 'PROCESSED', 'FAILED'] },
        retries: { bsonType: 'int', minimum: 0 },
        timestamp: { bsonType: 'date' },
        processedAt: { bsonType: ['date', 'null'] },
        error: { bsonType: ['string', 'null'] }
      }
    }
  }
});

db.events.createIndex({ 'status': 1, 'timestamp': -1 });
db.events.createIndex({ 'eventType': 1, 'timestamp': -1 });
db.events.createIndex({ 'userId': 1, 'timestamp': -1 });
db.events.createIndex({ 'timestamp': -1 }, { expireAfterSeconds: 2592000 }); // 30 days
```

---

## 3. Logs Collection

```javascript
db.createCollection('logs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['level', 'message', 'timestamp'],
      properties: {
        _id: { bsonType: 'objectId' },
        level: { bsonType: 'string', enum: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'] },
        message: { bsonType: 'string' },
        service: { bsonType: 'string' },
        module: { bsonType: 'string' },
        userId: { bsonType: ['string', 'null'] },
        requestId: { bsonType: ['string', 'null'] },
        timestamp: { bsonType: 'date' },
        stack: { bsonType: ['string', 'null'] },
        context: { bsonType: 'object' },
        environment: { bsonType: 'string' },
        version: { bsonType: 'string' }
      }
    }
  }
});

db.logs.createIndex({ 'level': 1, 'timestamp': -1 });
db.logs.createIndex({ 'service': 1, 'timestamp': -1 });
db.logs.createIndex({ 'timestamp': -1 }, { expireAfterSeconds: 5184000 }); // 60 days
```

---

## 4. Reviews & Ratings Collection

```javascript
db.createCollection('reviews', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['authorId', 'targetId', 'rating', 'timestamp'],
      properties: {
        _id: { bsonType: 'objectId' },
        authorId: { bsonType: 'string' },
        targetId: { bsonType: 'string' },
        targetType: { bsonType: 'string', enum: ['PRODUCT', 'DRIVER', 'PROPERTY', 'SELLER', 'SERVICE'] },
        module: { bsonType: 'string' },
        rating: { bsonType: 'int', minimum: 1, maximum: 5 },
        title: { bsonType: 'string' },
        content: { bsonType: 'string' },
        images: { bsonType: 'array', items: { bsonType: 'string' } },
        verified_purchase: { bsonType: 'bool' },
        helpful_count: { bsonType: 'int', minimum: 0 },
        unhelpful_count: { bsonType: 'int', minimum: 0 },
        status: { bsonType: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
        timestamp: { bsonType: 'date' },
        updated_at: { bsonType: 'date' }
      }
    }
  }
});

db.reviews.createIndex({ 'targetId': 1, 'timestamp': -1 });
db.reviews.createIndex({ 'authorId': 1, 'timestamp': -1 });
db.reviews.createIndex({ 'rating': 1, 'timestamp': -1 });
db.reviews.createIndex({ 'module': 1, 'rating': 1 });
```

---

## 5. Messages/Chat Collection

```javascript
db.createCollection('messages', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['senderId', 'conversationId', 'content', 'timestamp'],
      properties: {
        _id: { bsonType: 'objectId' },
        conversationId: { bsonType: 'string' },
        senderId: { bsonType: 'string' },
        content: { bsonType: 'string' },
        messageType: { bsonType: 'string', enum: ['TEXT', 'IMAGE', 'FILE', 'LOCATION'] },
        attachments: { bsonType: 'array', items: { bsonType: 'object' } },
        timestamp: { bsonType: 'date' },
        read: { bsonType: 'bool', default: false },
        read_at: { bsonType: ['date', 'null'] },
        edited: { bsonType: 'bool', default: false },
        edited_at: { bsonType: ['date', 'null'] },
        deleted: { bsonType: 'bool', default: false },
        reactions: { bsonType: 'object' } // {emoji: [userId]}
      }
    }
  }
});

db.messages.createIndex({ 'conversationId': 1, 'timestamp': -1 });
db.messages.createIndex({ 'senderId': 1, 'timestamp': -1 });
db.messages.createIndex({ 'conversationId': 1, 'read': 1 });
```

---

## 6. Conversations Collection

```javascript
db.createCollection('conversations', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['participants', 'createdAt'],
      properties: {
        _id: { bsonType: 'objectId' },
        participants: { bsonType: 'array', items: { bsonType: 'string' } },
        type: { bsonType: 'string', enum: ['DIRECT', 'GROUP'] },
        name: { bsonType: ['string', 'null'] },
        description: { bsonType: ['string', 'null'] },
        avatar: { bsonType: ['string', 'null'] },
        lastMessage: { bsonType: 'object' },
        lastMessageAt: { bsonType: 'date' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
        muted_by: { bsonType: 'array', items: { bsonType: 'string' } },
        archived_by: { bsonType: 'array', items: { bsonType: 'string' } }
      }
    }
  }
});

db.conversations.createIndex({ 'participants': 1 });
db.conversations.createIndex({ 'lastMessageAt': -1 });
db.conversations.createIndex({ 'createdAt': -1 });
```

---

## 7. Notifications Preferences Collection

```javascript
db.createCollection('notification_preferences', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId'],
      properties: {
        _id: { bsonType: 'objectId' },
        userId: { bsonType: 'string' },
        preferences: {
          bsonType: 'object',
          properties: {
            email_enabled: { bsonType: 'bool', default: true },
            sms_enabled: { bsonType: 'bool', default: true },
            push_enabled: { bsonType: 'bool', default: true },
            in_app_enabled: { bsonType: 'bool', default: true },
            payment_alerts: { bsonType: 'bool', default: true },
            order_updates: { bsonType: 'bool', default: true },
            promo_offers: { bsonType: 'bool', default: false },
            newsletter: { bsonType: 'bool', default: false }
          }
        },
        quiet_hours: {
          bsonType: 'object',
          properties: {
            enabled: { bsonType: 'bool' },
            start_time: { bsonType: 'string' },
            end_time: { bsonType: 'string' }
          }
        },
        updated_at: { bsonType: 'date' }
      }
    }
  }
});

db.notification_preferences.createIndex({ 'userId': 1 }, { unique: true });
```

---

## 8. Time-Series Data (For Analytics/Metrics)

```javascript
db.createCollection('metrics', {
  timeseries: {
    timeField: 'timestamp',
    metaField: 'metadata',
    granularity: 'minutes'
  }
});

// Metrics documents structure:
{
  _id: ObjectId(),
  timestamp: ISODate(),
  metadata: {
    module: 'JDV_MARKET',
    metric_type: 'transaction_volume'
  },
  value: 1500.50,
  currency: 'XOF',
  count: 25
}
```

---

## 9. Search Index (For Full-Text Search)

```javascript
// Create search index for products
db.market_products_search.createSearchIndex([
  {
    mappings: {
      dynamic: true,
      fields: {
        title: {
          type: 'string',
          analyzer: 'lucene.standard'
        },
        description: {
          type: 'string',
          analyzer: 'lucene.standard'
        },
        category: {
          type: 'string'
        },
        price: {
          type: 'number'
        },
        rating: {
          type: 'number'
        }
      }
    }
  }
]);
```

---

## 10. Cache Collection (Temporary Data)

```javascript
db.createCollection('cache', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['key', 'value', 'expireAt'],
      properties: {
        _id: { bsonType: 'objectId' },
        key: { bsonType: 'string' },
        value: { bsonType: 'object' },
        type: { bsonType: 'string' },
        expireAt: { bsonType: 'date' },
        createdAt: { bsonType: 'date' }
      }
    }
  }
});

// TTL Index - automatically delete expired cache
db.cache.createIndex({ 'expireAt': 1 }, { expireAfterSeconds: 0 });
db.cache.createIndex({ 'key': 1 }, { unique: true });
```

---

## Replication & Backup Strategy

```javascript
// Set up replica sets for high availability
rs.initiate({
  _id: 'rs0',
  members: [
    { _id: 0, host: 'mongo1:27017' },
    { _id: 1, host: 'mongo2:27017' },
    { _id: 2, host: 'mongo3:27017', arbiterOnly: true }
  ]
});
```

---

## Aggregation Pipeline Examples

### Example 1: Sales Analytics by Module
```javascript
db.events.aggregate([
  { $match: { eventType: 'PAYMENT_COMPLETED', timestamp: { $gte: new Date(Date.now() - 30*24*60*60*1000) } } },
  { $group: { _id: '$module', total: { $sum: '$payload.amount' }, count: { $sum: 1 } } },
  { $sort: { total: -1 } }
]);
```

### Example 2: User Activity Heatmap
```javascript
db.analytics.aggregate([
  { $match: { timestamp: { $gte: new Date(Date.now() - 7*24*60*60*1000) } } },
  { $group: { _id: { $hour: '$timestamp' }, count: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]);
```

---

## Security & Access Control

```javascript
// Create database user with restricted permissions
db.createUser({
  user: 'jdv_app',
  pwd: 'strong_password_here',
  roles: [
    { role: 'readWrite', db: 'jdv_global' },
    { role: 'dbAdmin', db: 'jdv_global' }
  ]
});
```

---

## Connection String

```
mongodb+srv://username:password@cluster.mongodb.net/jdv_global?retryWrites=true&w=majority
```