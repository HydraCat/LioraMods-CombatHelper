/*:
 * @target MZ
 * @plugindesc This plugin shows known bestiary information of enemies in combat to help the player make decisions.
 * @author HydraCat
 * 
 * @help
 * This plugin shows known bestiary information of enemies in combat to help the player make decisions.
 * 
 */

CombatHelper = {};

(($) => {
    // Indicate that the mod is active
    if (!AuraMZ.gameVersion.includes("-modded")){
        AuraMZ.gameVersion = AuraMZ.gameVersion + "-modded";
    }


    //Load plugin after compendium plugins
	const checkInterval = setInterval(() => {
		if (PluginManagerEx.isExistPlugin("compendium") && PluginManagerEx.isExistPlugin("TLB_SKAUICompendium")) {
            clearInterval(checkInterval);

            //Force the battlemanager to give enemies their actions before the player acts so we can show them
            const _BattleManager_startInput = BattleManager.startInput;
            BattleManager.startInput = function() {
                $gameTroop.makeActions();
                _BattleManager_startInput.call(this);
            };
            //Approximates damage with 0 variance, then calculates max and min variance separately
            $.approximateDamage = function(target, action) {
                if (action.item().damage.type > 0) {
                    let critical = false;
                    critical = 1 <= action.itemCri(target);
                    let variance = action.item().damage.variance;
                    action.item().damage.variance = 0;
                    baseDamage = action.makeDamageValue(target, critical);
                    action.item().damage.variance = variance;
                    return [$.maxVariance(action, baseDamage, variance, false), $.maxVariance(action, baseDamage, variance, true)]
                }
                return [0,0];
            };
            //Forces the variance formula with max or min results, will be wrong if the formula changes but that isn't really avoidable due to how the formula works
            $.maxVariance = function(action, damage, variance, positive) {
                const amp = Math.floor(Math.max((Math.abs(damage) * variance) / 100, 0));
                // Reduce random component by luck rate and instead add fixed variance based on luck rate
                const lukEffectRate = damage > 0 ? action.lukEffectRate(action._currentTarget) : 1;
                const amp1 = lukEffectRate > 1 ? amp / lukEffectRate : amp;
                const amp2 = lukEffectRate < 1 ? amp * lukEffectRate : amp;
                let v;
                if (positive){
                    v = Math.floor(amp2);
                }else{
                    v = Math.floor(amp1*-1);
                }
                return damage >= 0 ? damage + v : damage - v;
            };
            //Draws the damage range on the enemy selection screen
            const _Window_BattleEnemy_drawItem = Window_BattleEnemy.prototype.drawItem;
            Window_BattleEnemy.prototype.drawItem = function(index) {
                _Window_BattleEnemy_drawItem.call(this, index);
                const enemy = this._enemies[index];
                const rect = this.itemLineRect(index);
                rect.x += 54;
                rect.y += 40;
                const style = TLB.SKAUICompendium.Styles.ELEMENT_RATE;
                const action = BattleManager.inputtingAction();
                if (action){
                    const approxDmg = $.approximateDamage(enemy, action);
                    let known = false;
                    const isDefKnown = BeastiaryManager.isKnownStat(enemy.enemyId(), 3);
                    const isMDefKnown = BeastiaryManager.isKnownStat(enemy.enemyId(), 5);
                    if ((action.isPhysical() && isDefKnown) || (action.isMagical() && isMDefKnown)){    
                        known = true;
                    }
                    if (known) {
                        let text = "%1 - %2".format(approxDmg[0], approxDmg[1]);
                        this.drawStyledText(text, style, rect.x + 230, rect.y, 116);
                    }
                }
            };
            //Adds party member's Agi to the battle hud
            const _Window_BattleHUD_prototype_updateParty = Window_BattleHUD.prototype.updateParty;
            Window_BattleHUD.prototype.updateParty = function(){
                _Window_BattleHUD_prototype_updateParty.call(this);
                const styles = TLB.SKABattleHUD.Styles;
                const battleMembers = $gameParty.battleMembers();
                for (const member of battleMembers) {
                    const frame = this._partyFrames[member.index()];
                    if (frame.visible) {
                        if (member.index() === 0) {
                            //Agi
                            const agi = member.agi;
                            if (agi != frame._lastAgi){
                                frame._textLayer.bitmap.clearRect(this._wpX, this._wpY + 15 + this.lineHeight(), 120, this.lineHeight());
                                this.drawText(100, "Agi: %1".format(agi), this._wpX + 5, this._wpY + 5 + this.lineHeight(), styles.WP_VALUE, member.index());
                                frame._lastAgi = agi;
                            }
                        }else{
                            //Agi
                            const agi = member.agi;
                            if (agi != frame._lastAgi){
                                frame._textLayer.bitmap.clearRect(this._mpX, this._mpY + 15 + this.lineHeight(), 120, this.lineHeight());
                                this.drawText(100, "Agi: %1".format(agi), this._mpX + 5, this._mpY + 5 + this.lineHeight(), styles.WP_VALUE, member.index());
                                frame._lastAgi = agi;
                            }
                        }
                    }
                }
            }
            //New, derived from drawValue, draws some text could've done it better now I understand things more but eh
            Window_BattleHUD.prototype.drawText = function(maxWidth, text, x, y, style, slot) {
                const frame = this._partyFrames[slot];
                const bitmap = frame._textLayer.bitmap;
                style = style.derive({ textOptions: { bitmap: bitmap } })
                this.drawStyledTextArray([
                    [text, style]
                ], x, y, maxWidth);
            }

            //Was a custom style, not currently doing anything interesting
            $.SKILL_STYLE = TLB.SKABattleHUD.Styles.VALUE.derive({});

            class Window_EnemyBattleHUD extends Window_BattleHUD {
                //Functions are altered so no need to change the constructor
                
                createSprites() {
                    //8 Slots is the max for RPGM troops
                    const slot1position = {x:20,y:30};
                    const slot2position = {x:20,y:170};
                    const slot3position = {x:20,y:310};
                    const slot4position = {x:20,y:450};
                    const slot5position = {x:20,y:590};
                    const slot6position = {x:152,y:30};
                    const slot7position = {x:152,y:590};
                    const slot8position = {x:284,y:590};
                    const spritePositions = [
                        slot1position,
                        slot2position,
                        slot3position,
                        slot4position,
                        slot5position,
                        slot6position,
                        slot7position,
                        slot8position
                    ];
            
                    this._partyFrames = [];//Frame for each enemy
                    for (let i = 0; i < spritePositions.length; ++i) {
                        const pos = spritePositions[i];
                        const slotSprite = this.createSlot(i);
                        slotSprite.position.set(pos.x, pos.y);
                        this.addChild(slotSprite);
                        this._partyFrames.push(slotSprite);
                    }
                }

                createSlot(slotIndex) {//Keeping the input even though we don't need it for consistency with the extended class
                    const container = new PIXI.Container();
                    container._gaugeContainer = new PIXI.Container();
                    container.addChild(container._gaugeContainer);
                    container._textLayer = new Sprite();
                    container._textLayer.bitmap = new Bitmap(250, 180);
                    container._textLayer.y -= 16;
                    container.addChild(container._textLayer);

                    return container;
                }

                //Only really places the gauges now as we don't want the rest of the ui
                createParty() {
                    this._hpX = 0;
                    this._hpY = 0;
                    this._mpX = 0;
                    this._mpY = 32;
            
                    for (let i = 0; i < Math.min($gameTroop._enemies.length, 8); i++) {
                        const frame = this._partyFrames[i];
                        const member = $gameTroop._enemies[i];

                        this.placeSKAGauge(member, "hp", this._hpX, this._hpY);
                        this.placeSKAGauge(member, "mp", this._mpX, this._mpY);
                                                
                    }
                }
                //Draw all the ui elements and update the gauges
                updateParty() {
                    const styles = TLB.SKABattleHUD.Styles;
                    const battleMembers = $gameTroop._enemies;

                    for (let i = 0; i < this._partyFrames.length; i++) {//Make invisible if not active in the fight yet
                        if (battleMembers[i]?.isAppeared()){
                            this._partyFrames[i].visible = true;
                        }else{
                            this._partyFrames[i].visible = false;
                        }
                    }
                    
                    for (const member of battleMembers) {
                        const frame = this._partyFrames[member.index()];
                        if (frame.visible) {
                            //Hp
                            const hp = member.hp;
                            const mhp = member.mhp;
                            if (hp !== frame._lastHp || mhp !== frame._lastMhp) {
                                frame._textLayer.bitmap.clearRect(this._hpX, this._hpY + 20, 120, this.lineHeight());
                                if (BeastiaryManager.isKnownStat(member._enemyId, 0)){
                                    this.drawValue(100, member.hp, member.mhp, this._hpX + 5, this._hpY + 20, styles.HP_VALUE, member.index());
                                }else{
                                    this.drawValue(100, "?", "?", this._hpX + 5, this._hpY + 20, styles.HP_VALUE, member.index());
                                }
                                frame._lastHp = hp;
                                frame._lastMhp = mhp;
                            }
                            //Mp
                            const mp = member.mp;
                            const mmp = member.mmp;
                            if (mp !== frame._lastMp || mmp !== frame._lastMmp) {
                                frame._textLayer.bitmap.clearRect(this._mpX, this._mpY + 20, 120, this.lineHeight() - 5);
                                if (BeastiaryManager.isKnownStat(member._enemyId, 1)){
                                    this.drawValue(100, member.mp, member.mmp, this._mpX + 5, this._mpY + 20, styles.MP_VALUE, member.index());
                                }else{
                                    this.drawValue(100, "?", "?", this._mpX + 5, this._mpY + 20, styles.MP_VALUE, member.index());
                                }
                                frame._lastMp = mp;
                                frame._lastMmp = mmp;
                            }
                            //Name
                            const battlerName = member.battlerName();
                            if (battlerName && battlerName !== frame._lastBattlerName) {
                                frame._textLayer.bitmap.clearRect(this._hpX, this._hpY - 11, 120, this.lineHeight());
                                this.drawText(100, member.name(), this._hpX + 3, this._hpY - 11, styles.ACTOR_ALIVE, member.index());
                                frame._lastBattlerName = battlerName;
                            }
                            //Agi
                            const agi = member.agi;
                            if (agi != frame._lastAgi){
                                frame._textLayer.bitmap.clearRect(this._mpX, this._mpY + 15 + this.lineHeight(), 120, this.lineHeight());
                                if (BeastiaryManager.isKnownStat(member._enemyId, 6)){
                                    this.drawText(100, "Agi: %1".format(agi), this._mpX + 5, this._mpY + 5 + this.lineHeight(), styles.WP_VALUE, member.index());
                                }else{
                                    this.drawText(100, "Agi: ?", this._mpX + 5, this._mpY + 5 + this.lineHeight(), styles.WP_VALUE, member.index());
                                }
                                frame._lastAgi = agi;
                            }
                            //Next Move (Likely)
                            const likelyAction = member.currentAction()?.item();
                            if (likelyAction != frame._lastAction){
                                frame._textLayer.bitmap.clearRect(this._mpX, this._mpY + 5 + this.lineHeight() + this.lineHeight(), 120, this.lineHeight());
                                this.contents.clearRect(frame.x + this._mpX + 5, frame._textLayer.worldTransform.ty + this._mpY - 15 + this.lineHeight() + this.lineHeight(), 130, this.lineHeight());
                                if (likelyAction){
                                    if (BeastiaryManager.isKnownSkill(member._enemyId, likelyAction.id)){
                                        this.drawStyledTextArray([
                                            [likelyAction.name, $.SKILL_STYLE.derive({ textOptions: { bitmap: frame._textLayer.bitmap } })],
                                        ], this._mpX + 5, this._mpY - 5 + this.lineHeight() + this.lineHeight(), 80);
                                        this.drawIcon(likelyAction.iconIndex, frame.x + this._mpX + 80, frame._textLayer.worldTransform.ty + this._mpY - 15 + this.lineHeight() + this.lineHeight());
                                    }else{
                                        this.drawStyledTextArray([
                                            ["?", $.SKILL_STYLE.derive({ textOptions: { bitmap: frame._textLayer.bitmap } })],
                                        ], this._mpX + 5, this._mpY - 5 + this.lineHeight() + this.lineHeight(), 80);
                                        this.drawIcon(4, frame.x + this._mpX + 80, frame._textLayer.worldTransform.ty + this._mpY - 15 + this.lineHeight() + this.lineHeight());
                                    }
                                }
                                frame._lastAction = likelyAction;                   
                            }
                            this.updateGauges(frame, member);
                        }
                    }
                }

                //Only update the gauges if you know the max hp or mp
                updateGauges(frame, member) {
                    for (const child of frame._gaugeContainer.children) {
                        if (child._battler !== member) {
                            child.setup(member, child._statusType);
                        }
                        if (child.update) {
                            if (child._statusType == "hp" && !BeastiaryManager.isKnownStat(child._battler._enemyId, 0)){
                                
                            }else if (child._statusType == "mp" && !BeastiaryManager.isKnownStat(child._battler._enemyId, 1)){

                            }else{
                                child.update();
                            }
                        }
                    }
                }
            }

            //Create the enemy hud window
            const _Scene_Battle_createAllWindows = Scene_Battle.prototype.createAllWindows;
            Scene_Battle.prototype.createAllWindows = function() {
                _Scene_Battle_createAllWindows.call(this);
                this.createEnemyHUDWindow();
            };

            Scene_Battle.prototype.createEnemyHUDWindow = function() {
                const rect = this.enemyHudWindowRect();
                this._enemyHudWindow = new Window_EnemyBattleHUD(rect);
                this.addChild(this._enemyHudWindow);
            }
        
            Scene_Battle.prototype.enemyHudWindowRect = function() {
                const ww = Graphics.width;
                const wh = Graphics.height;
                const wx = 0;
                const wy = 0;
                return new Rectangle(wx, wy, ww, wh);
            };

		}
	}, 50);

})(CombatHelper);