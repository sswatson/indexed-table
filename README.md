# Microtable

Microtable is a lightweight in-memory DataFrame for JavaScript. At less than 3 KB minified, it's between 100 and 1000 times smaller than more full-featured DataFrame libraries like [Arquero](https://uwdata.github.io/arquero/), [https://sql.js.org/](sql.js), or [Danfo](https://danfo.jsdata.org/). You can think of it like a Javascript `Map` that:

1. Supports arbirarily many columns instead of just keys and values.
2. Supports constant-time lookup of any column value based on any combination of other columns.

## Installation

You can install Microtable via npm:

```bash
npm install microtable
```

## Basic Usage

First, import the `Microtable` class:

```javascript
import { Microtable } from "microtable";
```

To create a new Microtable, use the `Microtable.create()` method:

```javascript
const myTable = Microtable.create([
    { person: "Alice", activity: "hiking", rating: 5 },
    { person: "Alice", activity: "swimming", rating: 3 },
    { person: "Bob", activity: "hiking", rating: 2 },
    { person: "Bob", activity: "swimming", rating: 4 },
    { person: "Bob", activity: "running", rating: 5 },
    { person: "Charlie", activity: "swimming", rating: 5 },
    { person: "Charlie", activity: "running", rating: 1 },
]);
```

## Querying

Microtable methods return new tables, allowing you to chain multiple operations together:

```javascript
const results = myTable
  .where({ person: "Bob" })
  .select("activity", "rating");
```

The `where` method filters `myTable` to only include rows where the person is Bob. The `select` method then returns a new table with only the activity and rating columns.

## Indexing and Uniqueness

Microtable supports the creation of indexes on any combination of fields to speed up querying:

```javascript
myTable.createIndex("activity", "rating");
```

After creating the index, queries that filter on the activity and rating fields will be faster.

You can also delete indexes:

```javascript
myTable.deleteIndex("activity", "rating");
```

Microtable supports the imposition of uniqueness constraints on any combination of fields:

```javascript
myTable.uniquenessConstraint("person", "activity");
```

Imposing a uniqueness constraint creates an index on the given columns automatically. Using the `deleteIndex` method on a combination of columns that has a uniqueness constraint removes both the index and the constraint.

## Inserting and Constraints

You can insert new records with the `insert()` method:

```javascript
myTable.insert({ person: "Charlie", activity: "hiking", rating: 4 });
```

If you insert a record that would violate a uniqueness constraint, existing records are deleted as necessary to accommodate the new record:

```javascript
myTable.insert({ person: "Alice", activity: "hiking", rating: 4 });
```

## Retrieving Single Values

The `single()` method can be used to retrieve a single value from the table. For example, to get Bob's rating for hiking:

```javascript
const rating = myTable
  .where({ person: "Bob", activity: "hiking" })
  .select("rating")
  .single();
```

## Testing

This library is tested with Jest. Please see the test files for detailed usage examples.


## License

This library is licensed under the MIT license. See the LICENSE file for more details.
