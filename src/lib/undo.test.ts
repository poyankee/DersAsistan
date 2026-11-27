import { beforeAll, describe, expect, it } from 'vitest'
import { canUndo, getData, initStore, saveTask, setData, undoLast } from './store'
import type { Task } from './types'

const task = (id: string, title: string): Task => ({ id, title, done: false, createdAt: 1 }) as Task

describe('geri alma', () => {
  beforeAll(async () => {
    await initStore()
  })

  it('son kaydı geri alır, hızlı art arda değişiklikleri tek adım sayar', async () => {
    saveTask(task('a', 'Bir'))
    await new Promise((r) => setTimeout(r, 1300))
    saveTask(task('b', 'İki'))
    saveTask({ ...task('b', 'İki'), title: 'İki (düzeltildi)' })
    expect(getData().tasks.map((t) => t.id)).toEqual(['a', 'b'])
    expect(undoLast()).toBe(true)
    expect(getData().tasks.map((t) => t.id)).toEqual(['a'])
    expect(undoLast()).toBe(true)
    expect(getData().tasks).toEqual([])
  })

  it('eşitlemenin değiştirdiği bölüme dokunmaz', async () => {
    while (canUndo()) undoLast()
    await new Promise((r) => setTimeout(r, 1300))
    saveTask(task('c', 'Üç'))
    // Uzaktan gelen değişiklik: geçmişe yazılmaz
    setData((d) => ({ ...d, tasks: [...d.tasks, task('r', 'Uzak')] }), { history: false })
    expect(undoLast()).toBe(false)
    expect(getData().tasks.map((t) => t.id)).toEqual(['c', 'r'])
  })
})
