/** Synthetic APC materialized-instance fixture. No manufacturer library or project data. */
export const amlAttribute=(key:string,value:string)=>`<Attribute Name="${key}"><Value>${value}</Value></Attribute>`;
export function automationMlFixture(){
 const a=amlAttribute,role=(value:string)=>`<SupportedRoleClass RefRoleClassPath="AutomationProjectConfigurationRoleClassLib/${value}"/>`;
 const channel=(label:string,num:number,type:string,io:string,length:number)=>`<ExternalInterface Name="${label}" RefBaseClassPath="AutomationProjectConfigurationInterfaceClassLib/Channel">${a('Number',String(num))}${a('Type',type)}${a('IoType',io)}${a('Length',String(length))}<Attribute Name="VendorFlag"><Value>NeverChange</Value></Attribute></ExternalInterface>`;
 const tag=(name:string,address:string,datatype:string,comment:string)=>`<ExternalInterface Name="${name}" RefBaseClassPath="AutomationProjectConfigurationInterfaceClassLib/Tag">${a('DataType',datatype)}${a('LogicalAddress',address)}${a('Comment',comment)}</ExternalInterface>`;
 return `<?xml version="1.0" encoding="utf-8"?>
<CAEXFile FileName="synthetic.aml" SchemaVersion="2.15"><AdditionalInformation><VendorPayload>NeverChange</VendorPayload></AdditionalInformation>
<RoleClassLib Name="AutomationProjectConfigurationRoleClassLib"><RoleClass Name="Device"/><RoleClass Name="DeviceItem"/><RoleClass Name="TagTable"/></RoleClassLib>
<InterfaceClassLib Name="AutomationProjectConfigurationInterfaceClassLib"><InterfaceClass Name="Tag"/><InterfaceClass Name="Channel"/></InterfaceClassLib>
<InstanceHierarchy Name="Engineering"><InternalElement ID="project" Name="Project"><InternalElement ID="station" Name="Station">${role('Device')}
<InternalElement ID="rack" Name="Rack0">${role('DeviceItem')}${a('PositionNumber','0')}
<InternalElement ID="cpu" Name="Controller">${role('DeviceItem')}${a('DeviceItemType','CPU')}${a('TypeIdentifier','Vendor:CPU')}${a('PositionNumber','0')}${a('ProductDesignation IEC','-A1')}${a('PlantDesignation IEC','Plant')}${a('LocationIdentifier IEC','Cabinet')}${a('Comment','Controller description')}
<InternalElement ID="table" Name="Signals">${role('TagTable')}${tag('Door','0.0','BOOL','Door closed')}${tag('Temperature','W2','INT','Temperature signal')}${tag('Lamp','0.0','BOOL','Lamp output')}</InternalElement>
</InternalElement>
<InternalElement ID="module" Name="Mixed IO">${role('DeviceItem')}${a('PositionNumber','1')}${a('TypeIdentifier','Vendor:IO')}${a('ProductDesignation IEC','-A1.1')}${a('Manufacturer','Synthetic')}
${channel('DI0',0,'Digital','Input',1)}${channel('AI0',0,'Analog','Input',16)}${channel('DO0',0,'Digital','Output',1)}${channel('DI1',1,'Digital','Input',1)}
</InternalElement></InternalElement></InternalElement>
<InternalLink Name="TagDI" RefPartnerSideA="module:DI0" RefPartnerSideB="table:Door"/>
<InternalLink Name="TagAI" RefPartnerSideA="module:AI0" RefPartnerSideB="table:Temperature"/>
<InternalLink Name="TagDO" RefPartnerSideA="module:DO0" RefPartnerSideB="table:Lamp"/>
<InternalElement ID="network" Name="Unmodeled network"><Attribute Name="UnknownNetworkConfiguration"><Value>NeverChange</Value></Attribute></InternalElement>
</InternalElement></InstanceHierarchy></CAEXFile>`;
}
