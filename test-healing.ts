
import { calculateSkillHealing } from './src/tools/strength-v2/calculations/healing'

const result = calculateSkillHealing({
    skillKey: 'skill1',
    stats: {
        healing: 1000,
    },
    coefficient: 180,
    breakthroughTraitHealingBonus: 10,
    hangingTraitHealingBonus: 15,
})

console.log('治療量測試結果：')
console.log(result)
