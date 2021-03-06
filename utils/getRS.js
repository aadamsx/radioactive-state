/*
 * getRS returns a "radioactive" object
 * whenever a "radioactive" object is mutated at any level, onChange function is called with (chain, value, trap)
 * chain is an array of keys, it is a full 'path' where the mutation took place starting from parent state object
 *
 * For Example:
 *
 * * state.a.b.c.d[2] = 100
 * *
 * * chain : ['a', 'b', 'c', 'd', '2']
 * * value : 100
 * * trap : 'set'
 */

import isObject from './isObject'

// global flag
// when disableOnChange is true, mutations made in radioactive-state does not call onChange
let disableOnChange = false

const getRS = (_state, onChange, chain = []) => {
  const state = typeof _state === 'function' ? _state() : _state
  if (!isObject(state)) return state

  // make all children radioactive and save it in a wrapper
  const radioactiveWrapper = Array.isArray(state) ? [] : {}
  Object.keys(state).forEach((key) => {
    radioactiveWrapper[key] = getRS(state[key], onChange, [...chain, key])
  })

  // when state is mutated $ gets incremented
  let $ = 0

  // make the wrapper radioactive
  return new Proxy(radioactiveWrapper, {

    set(target, prop, value) {
      if (disableOnChange) return Reflect.set(target, prop, value)
      return onChange([...chain, prop], value, 'set')
    },

    deleteProperty(target, prop) {
      if (disableOnChange) return Reflect.deleteProperty(target, prop)
      return onChange([...chain, prop], undefined, 'deleteProperty')
    },

    get(target, prop) {

      // isRadioactive API
      if (prop === '__isRadioactive__') return true

      // mutation flag API
      if (prop === '$') return $
      if (prop === '__INC$__') return () => { $++ }

      if (prop === '__disableOnChange__') return value => { disableOnChange = value }

      // reactive binding API
      if (prop[0] === '$') {
        const actualProp = prop.substr(1)
        if (target.hasOwnProperty(actualProp)) {

          let key = 'value'
          const propType = typeof target[actualProp]
          if (propType === 'boolean') {
            key = 'checked'
          }

          const binding =  {
            [key]: target[actualProp],
            onChange: e => {
              let value = e.target[key]
              if (propType === 'number') value = Number(value)
              // to prevent cursor jumping to end, call forceUpdate now !
              onChange([...chain, actualProp], value, 'set', true)
            }
          }

          return binding
        }
      }

      return Reflect.get(target, prop)
    },

  })
}

export default getRS
