import { describe, it, expect } from 'vitest'
import { queryKeys } from '../query-keys'

describe('queryKeys', () => {
  it('entry key contains all segments in order', () => {
    expect(queryKeys.entry('alice', 'blog', 'main', 'posts/hello.md', 'posts'))
      .toEqual(['entry', 'alice', 'blog', 'main', 'posts/hello.md', 'posts'])
  })

  it('entryHistory key contains all segments in order', () => {
    expect(queryKeys.entryHistory('alice', 'blog', 'main', 'posts/hello.md', 'posts'))
      .toEqual(['entryHistory', 'alice', 'blog', 'main', 'posts/hello.md', 'posts'])
  })

  it('collection key contains collectionPath as last element', () => {
    expect(queryKeys.collection('alice', 'blog', 'main', 'posts', 'content/posts'))
      .toEqual(['collection', 'alice', 'blog', 'main', 'posts', 'content/posts'])
  })

  it('collectionAll is a prefix of collection (enables broad invalidation)', () => {
    const all = queryKeys.collectionAll('alice', 'blog', 'main', 'posts')
    const specific = queryKeys.collection('alice', 'blog', 'main', 'posts', 'content/posts')
    expect([...specific].slice(0, all.length)).toEqual([...all])
  })
})
